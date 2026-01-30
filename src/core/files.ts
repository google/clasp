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

// This file manages the synchronization of files between the local filesystem
// and the Google Apps Script project. It handles pulling, pushing, collecting
// local files, watching for changes, and resolving file types and conflicts.

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
 * Represents a file within an Apps Script project, either locally or remotely.
 * @property {string} localPath - The path of the file on the local filesystem, relative to the current working directory.
 * @property {string} [remotePath] - The name of the file as it appears in the Apps Script project (often without extension, or 'appsscript' for the manifest).
 * @property {string} [source] - The source content of the file.
 * @property {string} [type] - The type of the file as defined by Apps Script (e.g., "SERVER_JS", "HTML", "JSON").
 */
export interface ProjectFile {
  readonly localPath: string; // Local filesystem path, relative to cwd
  readonly remotePath?: string; // Name of file in apps script project
  readonly source?: string;
  readonly type?: string;
}

function parentDirs(file: string) {
  const parentDirs = [];
  let currentDir = path.dirname(file);
  while (currentDir !== '.') {
    parentDirs.push(currentDir);
    currentDir = path.dirname(currentDir);
  }
  return parentDirs;
}

async function getLocalFiles(rootDir: string, ignorePatterns: string[], recursive: boolean) {
  debug('Collecting files in %s', rootDir);
  let fdirBuilder = new fdir().withBasePath().withRelativePaths();
  if (!recursive) {
    debug('Not recursive, limiting depth to current directory');
    fdirBuilder = fdirBuilder.withMaxDepth(0); // Limit crawling to the current directory if not recursive
  }
  const files = await fdirBuilder.crawl(rootDir).withPromise();
  let filteredFiles: string[];
  if (ignorePatterns && ignorePatterns.length) {
    // Filter out files that are explicitly ignored by the .claspignore file or default ignore patterns.
    filteredFiles = micromatch.not(files, ignorePatterns, {dot: true});
    debug('Filtered %d files from ignore rules', files.length - filteredFiles.length);
  } else {
    debug('Ignore rules are empty, using all files.');
    filteredFiles = files;
  }
  filteredFiles.sort((a, b) => a.localeCompare(b));
  return filteredFiles[Symbol.iterator]();
}

async function getUnfilteredLocalFiles(rootDir: string) {
  debug('Collecting files in %s', rootDir);
  const fdirBuilder = new fdir().withBasePath();
  const files = await fdirBuilder.crawl(rootDir).withPromise();
  files.sort((a, b) => a.localeCompare(b));
  return files[Symbol.iterator]();
}

function createFilenameConflictChecker() {
  const files = new Set<string>();
  return (file: ProjectFile) => {
    if (file.type !== 'SERVER_JS') {
      return file; // Conflict check only applies to SERVER_JS files
    }
    const parsedPath = path.parse(file.localPath);
    // Create a key based on directory and name (without extension) to detect conflicts
    // e.g. `src/Code.js` and `src/Code.gs` would conflict.
    const key = path.format({dir: parsedPath.dir, name: parsedPath.name});
    if (files.has(key)) {
      throw new Error('Conflicting files found', {
        // TODO: Better error message, show conflicting files
        cause: {
          code: 'FILE_CONFLICT',
          value: key,
        },
      });
    }
    return file;
  };
}

function getFileType(fileName: string, fileExtensions: Record<string, string[]>) {
  const originalExtension = path.extname(fileName);
  const extension = originalExtension.toLowerCase();
  if (fileExtensions['SERVER_JS']?.includes(extension)) {
    return 'SERVER_JS';
  }
  if (fileExtensions['HTML']?.includes(extension)) {
    return 'HTML';
  }
  if (fileExtensions['JSON']?.includes(extension) && path.basename(fileName, originalExtension) === 'appsscript') {
    return 'JSON';
  }
  return undefined;
}

function getFileExtension(type: string | null | undefined, fileExtensions: Record<string, string[]>) {
  // TODO - Include project setting override
  const extensionFor = (type: string, defaultValue: string) => {
    // Prioritize the first extension defined for a type in .clasp.json if available.
    if (fileExtensions[type] && fileExtensions[type][0]) {
      return fileExtensions[type][0];
    }
    return defaultValue; // Fallback to default if no specific extension is configured.
  };
  switch (type) {
    case 'SERVER_JS':
      return extensionFor('SERVER_JS', '.js'); // Default to .js for server-side JavaScript
    case 'JSON':
      return extensionFor('JSON', '.json'); // Default to .json for JSON files (e.g. appsscript.json)
    case 'HTML':
      return extensionFor('HTML', '.html'); // Default to .html for HTML files
    default:
      // This case should ideally not be reached if file types are correctly identified.
      throw new Error('Invalid file type', {
        cause: {
          code: 'INVALID_FILE_TYPE',
          value: type,
        },
      });
  }
}

function debounceFileChanges<T>(callback: (files: T[]) => Promise<void> | void, delayMs: number) {
  let timeoutId: NodeJS.Timeout | undefined;
  let collectedPaths: T[] = [];

  return function (path: T) {
    // Already tracked as changed, ignore
    if (collectedPaths.includes(path)) {
      debug('Ignoring pending file change for path %s', path);
      return;
    }

    debug('Debouncing change for path %s', path);
    collectedPaths.push(path);

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      debug('Firing debounced file');
      callback(collectedPaths);
      collectedPaths = [];
    }, delayMs);
  };
}

/**
 * Manages operations related to project files, including fetching remote files,
 * collecting local files based on ignore patterns, watching for local changes,
 * pushing local changes to the remote project, and pulling remote files
 * to the local filesystem.
 */
export class Files {
  private options: ClaspOptions;

  /**
   * Constructs a new Files instance.
   * @param {ClaspOptions} options - Configuration options for file operations.
   */
  constructor(options: ClaspOptions) {
    this.options = options;
  }

  /**
* Fetches the content of a script project from Google Drive.
* @param {number} [versionNumber] - Optional version number to fetch.
* If not specified, the latest version (HEAD) is fetched.
* @returns {Promise<ProjectFile[]>} A promise that resolves to an array of project files.
* @throws {Error} If there's an API error or authentication/configuration issues.
*/
async fetchRemote(versionNumber?: number): Promise<ProjectFile[]> {
debug('Fetching remote files, version %s', versionNumber ?? 'HEAD');
assertAuthenticated(this.options);
assertScriptConfigured(this.options);

const credentials = this.options.credentials;
const contentDir = this.options.files.contentDir;
const scriptId = this.options.project.scriptId;
const script = google.script({version: 'v1', auth: credentials});
const fileExtensionMap = this.options.files.fileExtensions;

try {
const requestOptions = {scriptId, versionNumber};
debug('Fetching script content, request %o', requestOptions);

const response = await script.projects.getContent(requestOptions);
const files = response.data.files ?? [];

//  Establish security boundary
const absoluteContentDir = path.resolve(contentDir);

return files.map(f => {
const ext = getFileExtension(f.type, fileExtensionMap);

// Resolve absolute path for remote file
const resolvedPath = path.resolve(contentDir, `${f.name}${ext}`);

//  Path traversal protection
if (!isInside(absoluteContentDir, resolvedPath)) {
throw new Error(
`Security Error: Remote file name "${f.name}" attempts to write outside the project directory.`
);
}

const localPath = path.relative(process.cwd(), resolvedPath);

const file: ProjectFile = {
localPath,
remotePath: f.name,
source: f.source,
type: f.type,
};

debug('Fetched file %O', file);
return file;
});
} catch (err) {
throw handleApiError(err as GaxiosError);
}
}

  /**
   * Collects all local files in the project's content directory, respecting ignore patterns.
   * It reads the content of each file and determines its type.
   * @returns {Promise<ProjectFile[]>} A promise that resolves to an array of local project files.
   * @throws {Error} If the project is not configured or there's a file conflict.
   */
  async collectLocalFiles(): Promise<ProjectFile[]> {
    debug('Collecting local files');
    assertScriptConfigured(this.options);

    const contentDir = this.options.files.contentDir;
    const ignorePatterns = this.options.files.ignorePatterns ?? [];
    const recursive = !this.options.files.skipSubdirectories;

    // Read all filenames as a flattened tree
    // Note: filePaths contain relative paths such as "test/bar.ts", "../../src/foo.js"
    const filelist = Array.from(await getLocalFiles(contentDir, ignorePatterns, recursive));
    const checkDuplicate = createFilenameConflictChecker();
    const fileExtensionMap = this.options.files.fileExtensions;
    const files = await Promise.all(
      filelist.map(async filename => {
        const localPath = path.relative(process.cwd(), path.join(contentDir, filename));
        const resolvedPath = path.relative(contentDir, localPath);
        const parsedPath = path.parse(resolvedPath);
        let remotePath = normalizePath(path.format({dir: parsedPath.dir, name: parsedPath.name}));

        const type = getFileType(localPath, fileExtensionMap);
        if (!type) {
          debug('Ignoring unsupported file %s', localPath);
          return undefined;
        }

        if (type === 'JSON' && path.basename(localPath) === 'appsscript.json') {
          // Manifest has a fixed path in script
          remotePath = 'appsscript';
        }

        const content = await fs.readFile(localPath);
        const source = content.toString();
        return checkDuplicate({localPath, remotePath, source, type});
      }),
    );
    return files.filter((f: ProjectFile | undefined): f is ProjectFile => f !== undefined);
  }

  /**
   * Watches for changes in local project files and triggers callbacks.
   * @param {() => Promise<void> | void} onReady - Callback executed when the watcher is ready.
   * @param {(files: string[]) => Promise<void> | void} onFilesChanged - Callback executed
   * when files are added, changed, or deleted, with a debounced list of changed file paths.
   * @returns {() => Promise<void>} A function that can be called to stop watching.
   */
  watchLocalFiles(
    onReady: () => Promise<void> | void,
    onFilesChanged: (files: string[]) => Promise<void> | void,
  ): () => Promise<void> {
    const ignorePatterns = this.options.files.ignorePatterns ?? [];
    const collector = debounceFileChanges(onFilesChanged, 500); // Debounce changes to avoid rapid firing

    const onChange = async (path: string) => {
      debug('Have file changes: %s', path);
      collector(path); // Collect changed paths
    };
    let matcher: Matcher | undefined;
    if (ignorePatterns && ignorePatterns.length) {
      // Custom matcher function for chokidar to respect .claspignore patterns.
      // This is necessary because chokidar's `ignored` option expects specific formats.
      matcher = (file, stats) => {
        if (!stats?.isFile()) {
          return false; // Only consider files for ignore matching
        }
        // Normalize file path relative to project root for consistent matching with ignorePatterns.
        file = path.relative(this.options.files.projectRootDir, file);
        // Check if the file is NOT in the list of files to keep (i.e., it should be ignored).
        const ignore = micromatch.not([file], ignorePatterns, {dot: true}).length === 0;
        return ignore;
      };
    }
    const watcher = chokidar.watch(this.options.files.contentDir, {
      persistent: true, // Keep watching until explicitly closed
      ignoreInitial: true, // Don't trigger 'add' events for existing files on startup
      cwd: this.options.files.contentDir, // Watch paths relative to contentDir
      ignored: matcher, // Use custom ignore logic if patterns are present
    });
    watcher.on('ready', onReady); // Callback when initial scan is complete
    watcher.on('add', onChange); // On new file addition
    watcher.on('change', onChange); // On file content change
    watcher.on('unlink', onChange);
    watcher.on('error', err => {
      debug('Unexpected error during watch: %O', err);
    });
    return async () => {
      debug('Stopping watch');
      await watcher.close();
    };
  }

  /**
   * Compares local files with remote files (HEAD version) to identify changes.
   * A file is considered changed if it's new locally or its content differs from the remote version.
   * @returns {Promise<ProjectFile[]>} A promise that resolves to an array of project files that have changed.
   */
  async getChangedFiles(): Promise<ProjectFile[]> {
    const [localFiles, remoteFiles] = await Promise.all([this.collectLocalFiles(), this.fetchRemote()]);

    // Iterate over local files and compare with their remote counterparts.
    return localFiles.reduce((changed: ProjectFile[], localFile: ProjectFile) => {
      const remote = remoteFiles.find(f => f.localPath === localFile.localPath);
      // A file is considered changed if it doesn't exist remotely or if its source content differs.
      if (!remote || remote.source !== localFile.source) {
        changed.push(localFile);
      }
      return changed;
    }, []);
  }

  /**
   * Identifies files present in the local content directory that are not tracked
   * by the Apps Script project (i.e., not in `.claspignore` or `appsscript.json`'s `filePushOrder`
   * and not matching supported file extensions).
   * @returns {Promise<string[]>} A promise that resolves to an array of untracked file paths,
   * collapsed to their common parent directories where applicable.
   */
  async getUntrackedFiles(): Promise<string[]> {
    debug('Collecting untracked files');
    assertScriptConfigured(this.options);

    const contentDir = this.options.files.contentDir;
    const cwd = process.cwd();
    const dirsWithIncludedFiles = new Set();
    const trackedFiles = new Set();
    const untrackedFiles = new Set<string>();
    const projectFiles = await this.collectLocalFiles();
    for (const file of projectFiles) {
      debug('Found tracked file %s', file.localPath);
      trackedFiles.add(file.localPath);
      // Save all parent paths of tracked files to allow quick lookup.
      // This helps in collapsing untracked file paths to their nearest common untracked parent.
      const dirs = parentDirs(file.localPath);
      dirs.forEach(dir => dirsWithIncludedFiles.add(dir));
    }

    // Get all files in the content directory without applying ignore rules yet.
    const allFiles = await getUnfilteredLocalFiles(contentDir);
    for (const file of allFiles) {
      const resolvedPath = path.relative(cwd, file);
      if (trackedFiles.has(resolvedPath)) {
        // If the file is already tracked (i.e., part of the project to be pushed), skip it.
        continue;
      }

      // Reduce path to the nearest parent directory that itself does not contain any tracked files.
      // This groups untracked files under their common untracked root.
      // For example, if 'node_modules/lib/a.js' and 'node_modules/lib/b.js' are untracked,
      // and 'node_modules/lib' contains no tracked files, this will report 'node_modules/lib/'.
      let excludedPath = resolvedPath;
      for (const dir of parentDirs(resolvedPath)) {
        if (dirsWithIncludedFiles.has(dir)) {
          // Stop if we reach a directory that is a parent of some tracked file.
          break;
        }
        excludedPath = path.normalize(`${dir}/`); // Mark as directory
      }
      debug('Found untracked file/directory %s', excludedPath);
      untrackedFiles.add(excludedPath);
    }

    const untrackedFilesArray = Array.from(untrackedFiles);
    untrackedFilesArray.sort((a, b) => a.localeCompare(b)); // Sort for consistent output
    return untrackedFilesArray;
  }

  /**
   * Pushes local project files to the Google Apps Script project.
   * Files are sorted according to `filePushOrder` from the manifest if specified.
   * Handles API errors, including syntax errors in pushed files.
   * @returns {Promise<ProjectFile[]>} A promise that resolves to an array of files that were pushed.
   * Returns an empty array if no files were found to push.
   * @throws {Error} If there's an API error, authentication/configuration issues, or a syntax error in the code.
   */
  async push() {
    debug('Pushing files');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const credentials = this.options.credentials;
    const scriptId = this.options.project.scriptId;

    const files = await this.collectLocalFiles();
    if (!files || files.length === 0) {
      debug('No files found to push.');
      return [];
    }

    const filePushOrder = this.options.files.filePushOrder ?? [];
    files.sort((a, b) => {
      const indexA = filePushOrder.indexOf(a.localPath);
      const indexB = filePushOrder.indexOf(b.localPath);

      // If neither file is in the push order, sort them alphabetically.
      if (indexA === -1 && indexB === -1) {
        return a.localPath.localeCompare(b.localPath);
      }
      // If only file B is in the push order, file B comes first.
      if (indexA === -1) {
        return 1;
      }
      // If only file A is in the push order, file A comes first.
      if (indexB === -1) {
        return -1;
      }
      // If both files are in the push order, sort by their index in the push order.
      return indexA - indexB;
    });

    // Prepare file objects for the Apps Script API request.
    try {
      const scriptFiles = files.map(f => ({
        name: f.remotePath,
        type: f.type,
        source: f.source,
      }));
      const script = google.script({version: 'v1', auth: credentials});

      const requestOptions = {
        scriptId,
        requestBody: {
          files: scriptFiles,
        },
      };
      debug('Updating content, request %O', requestOptions);
      await script.projects.updateContent(requestOptions);
      return files;
    } catch (error) {
      debug(error);
      if (error instanceof GaxiosError) {
        const syntaxError = extractSyntaxError(error, files);
        if (syntaxError) {
          throw new Error(syntaxError.message, {
            cause: {
              code: 'SYNTAX_ERROR',
              error: error,
              snippet: syntaxError.snippet,
            },
          });
        }
      }
      handleApiError(error);
    }
  }

  /**
   * Checks if any files specified in the `filePushOrder` of the manifest
   * were not actually pushed. This can help identify misconfigurations.
   * @param {ProjectFile[]} pushedFiles - An array of files that were successfully pushed.
   * @returns {void} This method does not return a value but may have side effects (e.g. logging) if implemented.
   * Currently, it only calculates missing files but doesn't do anything with the result.
   */
  checkMissingFilesFromPushOrder(pushedFiles: ProjectFile[]) {
    const missingFiles = [];
    for (const path of this.options.files.filePushOrder ?? []) {
      const wasPushed = pushedFiles.find(f => f.localPath === path);
      if (!wasPushed) {
        missingFiles.push(path);
      }
    }
  }

  /**
   * Fetches remote project files (optionally a specific version) and writes them
   * to the local filesystem, overwriting existing files.
   * @param {number} [version] - Optional version number to pull. If not specified,
   * the latest version (HEAD) is pulled.
   * @returns {Promise<ProjectFile[]>} A promise that resolves to an array of files that were pulled.
   * @throws {Error} If there's an API error or authentication/configuration issues.
   */
  async pull(version?: number) {
    debug('Pulling files');
    assertAuthenticated(this.options);
    assertScriptConfigured(this.options);

    const files = await this.fetchRemote(version);
    await this.WriteFiles(files);
    return files;
  }

  private async WriteFiles(files: ProjectFile[]) {
    debug('Writing files');
    const mapper = async (file: ProjectFile) => {
      debug('Write file %s', path.resolve(file.localPath));
      if (!file.source) {
        debug('Skipping empty file.');
        return;
      }
      const localDirname = path.dirname(file.localPath);
      if (localDirname !== '.') {
        await fs.mkdir(localDirname, {recursive: true});
      }
      await fs.writeFile(file.localPath, file.source);
    };
    return await pMap(files, mapper);
  }
}

function extractSyntaxError(error: GaxiosError, files: ProjectFile[]) {
  let message = error.message;
  let snippet = '';
  // Try to parse the error message for syntax error details.
  // Example: "Syntax error: Missing ; before statement. line: 1 file: Code"
  const re = /Syntax error: (.+) line: (\d+) file: (.+)/;
  const [, errorName, lineNum, fileName] = re.exec(error.message) ?? [];

  if (fileName === undefined) {
    // If parsing fails, it's not a recognized syntax error format.
    return undefined;
  }

  message = `${errorName} - "${fileName}:${lineNum}"`;

  // Attempt to create a code snippet for the error.
  const contextCount = 4; // Number of lines before and after the error line to include.
  const errFile = files.find((x: ProjectFile) => x.remotePath === fileName);
  if (!errFile || !errFile.source) {
    // If the source file of the error cannot be found, no snippet can be generated.
    return undefined;
  }

  const srcLines = errFile.source.split('\n');
  const errIndex = Math.max(parseInt(lineNum) - 1, 0); // 0-based index
  const preIndex = Math.max(errIndex - contextCount, 0);
  const postIndex = Math.min(errIndex + contextCount + 1, srcLines.length);

  // Format the snippet with dim context lines and a bold error line.
  const preLines = chalk.dim(`  ${srcLines.slice(preIndex, errIndex).join('\n  ')}`);
  const errLine = chalk.bold(`⇒ ${srcLines[errIndex]}`);
  const postLines = chalk.dim(`  ${srcLines.slice(errIndex + 1, postIndex).join('\n  ')}`);

  snippet = preLines + '\n' + errLine + '\n' + postLines;
  return {message, snippet}; // Return the formatted message and snippet.
}

