// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Manages operations related to local and remote Apps Script project files.
 * This includes collecting local files according to .claspignore rules,
 * fetching remote files from the Apps Script API, pushing local changes,
 * pulling remote changes, and watching for local file modifications.
 */

import path from 'path';
import chalk from 'chalk';
import chokidar, {Matcher} from 'chokidar';
import Debug from 'debug';
import {fdir} from 'fdir';
import fs from 'fs/promises';
import {google} from 'googleapis';
import {GaxiosError} from 'googleapis-common';
import micromatch from 'micromatch';
import normalizePath from 'normalize-path';
import pMap from 'p-map';

import {ClaspOptions, assertAuthenticated, assertScriptConfigured, handleApiError} from './utils.js';

const debug = Debug('clasp:core');

/**
 * Represents a file in an Apps Script project, containing both its local
 * and remote (Apps Script server) representations.
 */
export interface ProjectFile {
  /** The local path of the file, relative to the current working directory. */
  readonly localPath: string;
  /** The name of the file as it appears in the Apps Script project (without extension for .gs files). Optional. */
  readonly remotePath?: string;
  /** The source content of the file. Optional. */
  readonly source?: string;
  /** The type of the file as defined by Apps Script (e.g., 'SERVER_JS', 'HTML', 'JSON'). Optional. */
  readonly type?: string;
}

/**
 * Utility function to get all parent directory paths for a given file path,
 * relative to the current directory structure being processed (stops at '.').
 * @param file The file path (relative).
 * @returns An array of parent directory paths.
 */
function parentDirs(file: string): string[] {
  const dirs: string[] = [];
  let currentDir = path.dirname(file);
  while (currentDir !== '.' && currentDir !== '/') { // Stop at root or current dir indicator
    dirs.push(currentDir);
    currentDir = path.dirname(currentDir);
  }
  return dirs;
}

/**
 * Collects local files from the specified root directory, applying ignore patterns
 * and respecting recursion settings.
 * @param rootDir The root directory to search for files.
 * @param ignorePatterns An array of glob patterns to ignore.
 * @param recursive Whether to search recursively into subdirectories.
 * @returns An iterator yielding relative file paths matching the criteria.
 */
async function getLocalFiles(
  rootDir: string,
  ignorePatterns: string[],
  recursive: boolean,
): Promise<IterableIterator<string>> {
  debug('Collecting files in %s, recursive: %s', rootDir, recursive);
  let fdirBuilder = new fdir().withBasePath().withRelativePaths();
  if (!recursive) {
    debug('Not recursive, limiting depth to current directory (maxDepth 0).');
    fdirBuilder = fdirBuilder.withMaxDepth(0);
  }
  const allFiles = await fdirBuilder.crawl(rootDir).withPromise();
  let filteredFiles: string[];

  if (ignorePatterns?.length > 0) {
    // Apply micromatch for powerful glob-based filtering.
    filteredFiles = micromatch.not(allFiles, ignorePatterns, {dot: true});
    debug(`Ignored ${allFiles.length - filteredFiles.length} files based on ignore rules. Kept ${filteredFiles.length} files.`);
  } else {
    debug('No ignore patterns specified, using all found files.');
    filteredFiles = allFiles;
  }
  // Sort for consistent processing order.
  filteredFiles.sort((a, b) => a.localeCompare(b));
  return filteredFiles[Symbol.iterator]();
}

/**
 * Collects all local files from the specified root directory without applying any ignore patterns.
 * @param rootDir The root directory to search for files.
 * @returns An iterator yielding relative file paths.
 */
async function getUnfilteredLocalFiles(rootDir: string): Promise<IterableIterator<string>> {
  debug('Collecting all unfiltered files in %s', rootDir);
  const fdirBuilder = new fdir().withBasePath().withRelativePaths(); // Ensure relative paths
  const files = await fdirBuilder.crawl(rootDir).withPromise();
  files.sort((a, b) => a.localeCompare(b)); // Sort for consistency
  return files[Symbol.iterator]();
}

/**
 * Creates a function that checks for filename conflicts among `SERVER_JS` files.
 * Apps Script requires unique filenames (excluding extension) for .gs or .js server files within the same directory level.
 * @returns A function that takes a `ProjectFile` and throws an error if a conflict is detected.
 */
function createFilenameConflictChecker(): (file: ProjectFile) => ProjectFile {
  const serverJsFiles = new Set<string>(); // Stores unique "directory/filename" (no ext) combinations.
  return (file: ProjectFile) => {
    if (file.type !== 'SERVER_JS') {
      return file; // Only check server-side JavaScript/AppsScript files.
    }
    // Create a key based on the directory and filename without extension.
    const parsed = path.parse(file.remotePath ?? file.localPath); // Use remotePath if available for server representation
    const key = normalizePath(path.join(parsed.dir, parsed.name));

    if (serverJsFiles.has(key)) {
      // Apps Script has a flat namespace for .gs files at the same effective directory level.
      // This means foo.js and foo.gs in the same directory, or foo/bar.js and foo/bar.gs, would conflict.
      // The remotePath is generally preferred here as it reflects the name on the server.
      throw new Error(
        `File conflict: More than one file would result in a file named "${parsed.name}" of type ${file.type} in the directory "${parsed.dir || './'}". Please ensure unique filenames (excluding extensions like .js or .gs) for server-side script files. Conflicting path: ${file.localPath}`,
        {
          cause: {
            code: 'FILE_CONFLICT',
            value: key,
            filePath: file.localPath,
          },
        },
      );
    }
    serverJsFiles.add(key);
    return file;
  };
}

/**
 * Determines the Apps Script file type based on the filename and configured file extensions.
 * @param fileName The local filename (e.g., 'Code.gs', 'appsscript.json', 'index.html').
 * @param fileExtensions A record mapping Apps Script file types to arrays of local extensions.
 * @returns The Apps Script file type string (e.g., 'SERVER_JS', 'JSON', 'HTML'), or undefined if not recognized.
 */
function getFileType(fileName: string, fileExtensions: Record<string, string[]>): string | undefined {
  const fileExtension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, path.extname(fileName)); // Filename without extension

  if (fileExtensions['SERVER_JS']?.includes(fileExtension)) {
    return 'SERVER_JS';
  }
  if (fileExtensions['HTML']?.includes(fileExtension)) {
    return 'HTML';
  }
  // The manifest file is always 'appsscript.json'.
  if (baseName === 'appsscript' && fileExtensions['JSON']?.includes(fileExtension)) {
    return 'JSON';
  }
  return undefined; // Not a recognized Apps Script file type for clasp.
}

/**
 * Gets the primary local file extension associated with a given Apps Script file type.
 * This is used when creating local files from remote ones (e.g., during a pull).
 * @param type The Apps Script file type (e.g., 'SERVER_JS', 'HTML', 'JSON').
 * @param fileExtensions A record mapping Apps Script file types to arrays of local extensions.
 * @returns The first configured local extension for that type, or a default if not configured.
 * @throws Error if the file type is invalid.
 */
function getFileExtension(type: string | null | undefined, fileExtensions: Record<string, string[]>): string {
  // TODO: Consider if project settings for specific file extensions should override these defaults more explicitly.
  const getPrimaryExtension = (fileType: string, defaultExtension: string): string => {
    return fileExtensions[fileType]?.[0] ?? defaultExtension;
  };

  switch (type) {
    case 'SERVER_JS':
      return getPrimaryExtension('SERVER_JS', '.js'); // Default to .js if .gs or other not specified.
    case 'JSON':
      return getPrimaryExtension('JSON', '.json');
    case 'HTML':
      return getPrimaryExtension('HTML', '.html');
    default:
      // This should not happen with valid file types from the API.
      throw new Error(`Invalid Apps Script file type: ${type}`);
  }
}

/**
 * Creates a debounced version of a callback function that is triggered after a specified delay
 * when file changes occur. It collects all file paths changed during the delay period.
 * @param callback The function to call after the debounce delay with an array of changed paths.
 * @param delayMs The debounce delay in milliseconds.
 * @returns A function that, when called with a file path, will trigger the debounced callback.
 * @template T The type of the path argument (typically string).
 */
function debounceFileChanges<T>(callback: (changedPaths: T[]) => Promise<void> | void, delayMs: number): (path: T) => void {
  let timeoutId: NodeJS.Timeout | undefined;
  let collectedChangedPaths: T[] = [];

  return function debounced(pathValue: T) {
    // If this path is already in the current batch, don't re-add.
    if (collectedChangedPaths.includes(pathValue)) {
      debug('Path %s already pending in current debounce cycle, ignoring duplicate.', pathValue);
      return;
    }

    debug('Debouncing change for path: %s', pathValue);
    collectedChangedPaths.push(pathValue);

    // Clear existing timeout to reset the debounce period.
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      debug('Debounce delay elapsed. Firing callback for %d changed paths.', collectedChangedPaths.length);
      void callback(collectedChangedPaths); // Use void to handle potential promise from callback.
      collectedChangedPaths = []; // Reset for the next set of changes.
    }, delayMs);
  };
}

/**
 * Manages all file-related operations for a Clasp project, including local file
 * system interactions and communication with the Apps Script API for file content.
 */
export class Files {
  private options: ClaspOptions;

  /**
   * Constructs a Files manager instance.
   * @param options The Clasp configuration options.
   */
  constructor(options: ClaspOptions) {
    this.options = options;
  }

  /**
   * Fetches all files for the Apps Script project from the remote server.
   * Can fetch a specific version or the latest (HEAD) version.
   * @param versionNumber Optional version number to fetch. Defaults to HEAD.
   * @returns A promise that resolves with an array of `ProjectFile` objects representing remote files.
   */
  async fetchRemote(versionNumber?: number): Promise<ProjectFile[]> {
    debug('Fetching remote files, version %s', versionNumber ?? 'HEAD');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    debug('Fetching remote files. Version: %s', versionNumber ?? 'HEAD');
    assertAuthenticated(this.options); // Ensure user is authenticated.
    assertScriptConfigured(this.options); // Ensure project (scriptId) is configured.

    const {credentials, files: fileOptions, project: projectOptions} = this.options;
    const script = google.script({version: 'v1', auth: credentials});

    try {
      const request = {scriptId: projectOptions.scriptId!, versionNumber}; // scriptId is asserted by assertScriptConfigured.
      debug('Requesting script content: %o', request);
      const response = await script.projects.getContent(request);
      const remoteFiles = response.data.files ?? [];

      return remoteFiles.map(remoteFile => {
        const fileTypeExtension = getFileExtension(remoteFile.type, fileOptions.fileExtensions);
        // Construct local path relative to CWD, within the configured content directory.
        const localFilePath = path.relative(
          process.cwd(),
          path.resolve(fileOptions.contentDir, `${remoteFile.name}${fileTypeExtension}`),
        );
        const projectFile: ProjectFile = {
          localPath: localFilePath,
          remotePath: remoteFile.name ?? undefined,
          source: remoteFile.source ?? undefined,
          type: remoteFile.type ?? undefined,
        };
        debug('Fetched remote file details: %O', projectFile);
        return projectFile;
      });
    } catch (error) {
      return handleApiError(error); // Standardized API error handling.
    }
  }

  /**
   * Collects all local files that are part of the Apps Script project,
   * respecting `.claspignore` rules and subdirectory settings.
   * @returns A promise that resolves with an array of `ProjectFile` objects.
   */
  async collectLocalFiles(): Promise<ProjectFile[]> {
    debug('Collecting local project files...');
    assertScriptConfigured(this.options); // Ensure project (scriptId) is configured.

    const {contentDir, ignorePatterns, skipSubdirectories, fileExtensions} = this.options.files;
    const searchRecursively = !skipSubdirectories;

    const localFilePaths = Array.from(await getLocalFiles(contentDir, ignorePatterns, searchRecursively));
    const conflictChecker = createFilenameConflictChecker();
    const projectFiles: ProjectFile[] = [];

    for (const relativeFilePath of localFilePaths) {
      // Full local path relative to CWD.
      const fullLocalPath = path.join(contentDir, relativeFilePath);
      // Path relative to the contentDir, used for determining remote path.
      const pathInContentDir = path.relative(contentDir, fullLocalPath);

      const fileType = getFileType(pathInContentDir, fileExtensions);
      if (!fileType) {
        debug('Ignoring unsupported file type: %s', fullLocalPath);
        continue; // Skip files not recognized as valid Apps Script types.
      }

      // Determine the remote path (name on Apps Script server).
      const parsedPath = path.parse(pathInContentDir);
      let remoteName = normalizePath(path.join(parsedPath.dir, parsedPath.name));
      if (fileType === 'JSON' && parsedPath.base.toLowerCase() === 'appsscript.json') {
        remoteName = 'appsscript'; // Manifest file has a fixed remote name.
      }

      try {
        const fileContent = await fs.readFile(fullLocalPath, 'utf8');
        projectFiles.push(conflictChecker({localPath: fullLocalPath, remotePath: remoteName, source: fileContent, type: fileType}));
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Could not read file ${fullLocalPath}. Skipping. Error: ${error.message}`));
      }
    }
    debug(`Collected ${projectFiles.length} local files.`);
    return projectFiles;
  }

  /**
   * Watches local project files for changes and triggers a callback.
   * Respects `.claspignore` rules.
   * @param onReady Callback function executed when the watcher is ready.
   * @param onFilesChanged Debounced callback function executed with an array of changed file paths.
   * @returns A function that, when called, stops the file watcher.
   */
  watchLocalFiles(
    onReady: () => Promise<void> | void,
    onFilesChanged: (changedPaths: string[]) => Promise<void> | void,
  ): () => Promise<void> {
    const {ignorePatterns, projectRootDir, contentDir} = this.options.files;
    // Debounce changes to handle rapid saves or multiple file changes gracefully.
    const debouncedOnChange = debounceFileChanges(onFilesChanged, 500);

    const handleChange = (filePath: string) => {
      debug('Local file change detected: %s', filePath);
      debouncedOnChange(filePath);
    };

    let chokidarMatcher: Matcher | undefined;
    if (ignorePatterns?.length > 0) {
      // Chokidar's `ignored` option needs paths relative to its `cwd`.
      // Here, `cwd` is `contentDir`, so paths for micromatch should be relative to `contentDir`.
      chokidarMatcher = (filePath: string, stats?: fs.Stats): boolean => {
        if (!stats?.isFile()) return false; // Only watch files.
        // Path relative to contentDir for matching against ignorePatterns.
        const relativePath = path.relative(contentDir, path.resolve(contentDir, filePath));
        return micromatch.isMatch(relativePath, ignorePatterns, {dot: true});
      };
    }

    debug('Starting file watcher on directory: %s', contentDir);
    const watcher = chokidar.watch('.', { // Watch relative to cwd for chokidar
      persistent: true,
      ignoreInitial: true, // Don't trigger for existing files at startup.
      cwd: contentDir, // Set current working directory for chokidar.
      ignored: chokidarMatcher, // Use the custom matcher for .claspignore.
    });

    watcher
      .on('ready', onReady)
      .on('add', handleChange)
      .on('change', handleChange)
      .on('unlink', handleChange)
      .on('error', error => debug('File watcher error: %O', error));

    return async () => {
      debug('Stopping file watcher.');
      await watcher.close();
    };
  }

  /**
   * Compares local project files with remote files to determine which local files have changed.
   * @returns A promise that resolves with an array of `ProjectFile` objects representing changed local files.
   */
  async getChangedFiles(): Promise<ProjectFile[]> {
    debug('Comparing local and remote files to find changes...');
    const [localProjectFiles, remoteProjectFiles] = await Promise.all([this.collectLocalFiles(), this.fetchRemote()]);

    return localProjectFiles.filter(localFile => {
      const correspondingRemoteFile = remoteProjectFiles.find(remoteFile => remoteFile.localPath === localFile.localPath);
      // A file is considered changed if it's not on the remote or its source content differs.
      return !correspondingRemoteFile || correspondingRemoteFile.source !== localFile.source;
    });
  }

  /**
   * Identifies local files that are not tracked by clasp (i.e., would be ignored during a push).
   * @returns A promise that resolves with an array of string paths for untracked files/directories,
   *          collapsing them to the nearest common untracked parent directory.
   */
  async getUntrackedFiles(): Promise<string[]> {
    debug('Identifying untracked local files...');
    assertScriptConfigured(this.options); // Requires project context.

    const {contentDir} = this.options.files;
    const currentWorkingDir = process.cwd();

    const trackedFilePaths = new Set<string>();
    const trackedParentDirs = new Set<string>(); // Keep track of directories containing tracked files.

    const projectFiles = await this.collectLocalFiles();
    for (const file of projectFiles) {
      const relativeLocalPath = path.relative(currentWorkingDir, file.localPath);
      trackedFilePaths.add(relativeLocalPath);
      // Add all parent directories of tracked files to the set.
      parentDirs(relativeLocalPath).forEach(dir => trackedParentDirs.add(dir));
    }

    const untrackedEntries = new Set<string>();
    const allLocalFilePaths = Array.from(await getUnfilteredLocalFiles(contentDir));

    for (const relativeFilePath of allLocalFilePaths) {
      const fullLocalPath = path.join(contentDir, relativeFilePath); // Path relative to CWD
      const pathRelativeToCwd = path.relative(currentWorkingDir, fullLocalPath);

      if (trackedFilePaths.has(pathRelativeToCwd)) {
        continue; // Skip tracked files.
      }

      // Attempt to collapse untracked files into their highest-level untracked parent directory.
      let displayPath = pathRelativeToCwd;
      let currentParent = path.dirname(pathRelativeToCwd);
      while (currentParent !== '.' && currentParent !== '/' && !trackedParentDirs.has(currentParent)) {
        displayPath = path.join(currentParent, '/'); // Mark as directory
        currentParent = path.dirname(currentParent);
      }
      untrackedEntries.add(normalizePath(displayPath));
    }

    const sortedUntracked = Array.from(untrackedEntries);
    sortedUntracked.sort((a, b) => a.localeCompare(b));
    debug(`Found ${sortedUntracked.length} untracked files/directories.`);
    return sortedUntracked;
  }

  /**
   * Pushes local project files to the Apps Script server.
   * Files are sorted according to `filePushOrder` from `.clasp.json` if specified.
   * Handles syntax errors returned by the API.
   * @returns A promise that resolves with an array of `ProjectFile` objects that were successfully pushed.
   * @throws Error if the push fails for reasons other than a syntax error (which is handled specifically).
   */
  async push(): Promise<ProjectFile[]> {
    debug('Pushing local files to Apps Script project...');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const {credentials, files: fileOptions, project: projectOptions} = this.options;
    const localFilesToPush = await this.collectLocalFiles();

    if (localFilesToPush.length === 0) {
      debug('No local files found to push.');
      return []; // Return empty array if no files to push.
    }

    // Sort files according to `filePushOrder` if specified in `.clasp.json`.
    const {filePushOrder = []} = fileOptions;
    localFilesToPush.sort((a, b) => {
      const indexA = filePushOrder.indexOf(a.localPath);
      const indexB = filePushOrder.indexOf(b.localPath);

      if (indexA === -1 && indexB === -1) return a.localPath.localeCompare(b.localPath); // Both not in order, sort alphabetically.
      if (indexA === -1) return 1; // B is in order, A is not; B comes first.
      if (indexB === -1) return -1; // A is in order, B is not; A comes first.
      return indexA - indexB; // Both in order, sort by their specified order.
    });

    // Prepare file objects for the API request.
    const apiFiles = localFilesToPush.map(file => ({
      name: file.remotePath,
      type: file.type,
      source: file.source,
    }));

    try {
      const script = google.script({version: 'v1', auth: credentials});
      const request = {
        scriptId: projectOptions.scriptId!, // Asserted by assertScriptConfigured
        requestBody: {files: apiFiles},
      };
      debug('Calling script.projects.updateContent with %d files.', apiFiles.length);
      await script.projects.updateContent(request);
      debug('Successfully pushed %d files.', localFilesToPush.length);
      return localFilesToPush;
    } catch (error) {
      debug('Error during push operation: %O', error);
      if (error instanceof GaxiosError) {
        // Attempt to extract and format Apps Script specific syntax errors.
        const extractedError = extractSyntaxError(error, localFilesToPush);
        if (extractedError) {
          throw new Error(extractedError.message, {
            cause: {code: 'SYNTAX_ERROR', error, snippet: extractedError.snippet},
          });
        }
      }
      return handleApiError(error); // General API error handling.
    }
  }

  /**
   * Checks if any files specified in the `filePushOrder` of `.clasp.json` were not pushed.
   * This is a utility method that can be used after a push operation.
   * @param pushedFiles An array of `ProjectFile` objects that were successfully pushed.
   * @returns An array of paths (from `filePushOrder`) that were not found in `pushedFiles`.
   */
  checkMissingFilesFromPushOrder(pushedFiles: ProjectFile[]): string[] {
    const {filePushOrder = []} = this.options.files;
    if (filePushOrder.length === 0) return [];

    const pushedPaths = new Set(pushedFiles.map(f => f.localPath));
    return filePushOrder.filter(orderedPath => !pushedPaths.has(orderedPath));
  }

  /**
   * Fetches remote project files and writes them to the local filesystem.
   * @param versionNumber Optional version number to pull. Defaults to HEAD.
   * @returns A promise that resolves with an array of `ProjectFile` objects that were pulled and written.
   */
  async pull(versionNumber?: number): Promise<ProjectFile[]> {
    debug('Pulling files from remote project. Version: %s', versionNumber ?? 'HEAD');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const remoteFiles = await this.fetchRemote(versionNumber);
    await this.writeProjectFiles(remoteFiles); // Corrected method name
    debug('Successfully pulled and wrote %d files.', remoteFiles.length);
    return remoteFiles;
  }

  /**
   * Writes an array of `ProjectFile` objects to the local filesystem.
   * Creates necessary subdirectories.
   * @param projectFiles Array of `ProjectFile` objects to write.
   */
  private async writeProjectFiles(projectFiles: ProjectFile[]): Promise<void> {
    debug('Writing %d project files to local disk...', projectFiles.length);
    const writeFileOperation = async (file: ProjectFile) => {
      if (typeof file.source !== 'string') { // Check if source is null or undefined
        debug('Skipping file with no source content: %s', file.localPath);
        return;
      }
      // Ensure parent directory exists.
      const directory = path.dirname(file.localPath);
      if (directory && directory !== '.') { // Avoid trying to create '.'
        await fs.mkdir(directory, {recursive: true});
      }
      await fs.writeFile(file.localPath, file.source);
      debug('Wrote file: %s', file.localPath);
    };
    // Use pMap for concurrent file writing, adjust concurrency as needed.
    await pMap(projectFiles, writeFileOperation, {concurrency: 5});
  }
}

/**
 * Extracts and formats syntax error details from a GaxiosError returned by the Apps Script API.
 * @param error The GaxiosError object from the API response.
 * @param files All `ProjectFile` objects that were part of the push attempt, used to find source for snippet.
 * @returns An object with `message` and `snippet` if a syntax error is found, otherwise undefined.
 */
function extractSyntaxError(error: GaxiosError, files: ProjectFile[]): {message: string; snippet: string} | undefined {
  // Error structure from Apps Script API for syntax errors:
  // error.response.data.error.details[0].errorDetails[0] contains {errorMessage, errorType, scriptStackTraceElements}
  // error.response.data.error.details[0].message often is "Script manifest.dependencies.libraries[0].userSymbol contains an invalid script ID."
  // We are looking for "Syntax error: ..." in the main error.message for script file errors.

  const mainErrorMessage = error.message;
  const syntaxErrorRegex = /Syntax error: (.+?) line: (\d+) file: (.+)/;
  const match = syntaxErrorRegex.exec(mainErrorMessage);

  if (!match) {
    return undefined; // Not a recognizable script syntax error message.
  }

  const [, errorName, lineNumberStr, fileNameFromError] = match;
  const lineNumber = parseInt(lineNumberStr, 10);

  const formattedMessage = `${errorName} in file "${fileNameFromError}" at line ${lineNumber}`;

  // Try to find the source file to generate a snippet.
  // Note: fileNameFromError might not directly match localPath or remotePath without normalization.
  // This assumes remotePath is the name without extension.
  const errorFile = files.find(f => f.remotePath === fileNameFromError || f.remotePath === path.parse(fileNameFromError).name);

  let codeSnippet = 'Could not retrieve code snippet.';
  if (errorFile?.source) {
    const sourceLines = errorFile.source.split('\n');
    const errorLineIndex = lineNumber - 1; // Line numbers are 1-based.
    const contextLines = 2; // Number of lines before and after the error line.

    const startLine = Math.max(0, errorLineIndex - contextLines);
    const endLine = Math.min(sourceLines.length, errorLineIndex + contextLines + 1);

    codeSnippet = sourceLines
      .slice(startLine, endLine)
      .map((line, index) => {
        const currentLineNumber = startLine + index + 1;
        const linePrefix = `${currentLineNumber.toString().padStart(4)} | `;
        if (currentLineNumber === lineNumber) {
          return chalk.red.bold(`> ${linePrefix}${line}`);
        }
        return chalk.dim(`  ${linePrefix}${line}`);
      })
      .join('\n');
  }

  return {message: formattedMessage, snippet: codeSnippet};
}
