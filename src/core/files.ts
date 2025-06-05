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
    fdirBuilder = fdirBuilder.withMaxDepth(0);
  }
  const files = await fdirBuilder.crawl(rootDir).withPromise();
  let filteredFiles: string[];
  if (ignorePatterns && ignorePatterns.length) {
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
      return file;
    }
    const parsedPath = path.parse(file.localPath);
    const key = path.format({dir: parsedPath.dir, name: parsedPath.name});
    if (files.has(key)) {
      throw new Error('Conflicting files found', {
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
    if (fileExtensions[type] && fileExtensions[type][0]) {
      return fileExtensions[type][0];
    }
    return defaultValue;
  };
  switch (type) {
    case 'SERVER_JS':
      return extensionFor('SERVER_JS', '.js');
    case 'JSON':
      return extensionFor('JSON', '.json');
    case 'HTML':
      return extensionFor('HTML', '.html');
    default:
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

export class Files {
  private options: ClaspOptions;

  constructor(options: ClaspOptions) {
    this.options = options;
  }

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
      return files.map(f => {
        const ext = getFileExtension(f.type, fileExtensionMap);
        const localPath = path.relative(process.cwd(), path.resolve(contentDir, `${f.name}${ext}`));

        const file = {
          localPath: localPath,
          remotePath: f.name ?? undefined,
          source: f.source ?? undefined,
          type: f.type ?? undefined,
        };
        debug('Fetched file %O', file);
        return file;
      });
    } catch (error) {
      handleApiError(error);
    }
  }

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

  watchLocalFiles(
    onReady: () => Promise<void> | void,
    onFilesChanged: (files: string[]) => Promise<void> | void,
  ): () => Promise<void> {
    const ignorePatterns = this.options.files.ignorePatterns ?? [];
    const collector = debounceFileChanges(onFilesChanged, 500);

    const onChange = async (path: string) => {
      debug('Have file changes: %s', path);
      collector(path);
    };
    let matcher: Matcher | undefined;
    if (ignorePatterns && ignorePatterns.length) {
      matcher = (file, stats) => {
        if (!stats?.isFile()) {
          return false;
        }
        file = path.relative(this.options.files.projectRootDir, file);
        const ignore = micromatch.not([file], ignorePatterns, {dot: true}).length === 0;
        return ignore;
      };
    }
    const watcher = chokidar.watch(this.options.files.contentDir, {
      persistent: true,
      ignoreInitial: true,
      cwd: this.options.files.contentDir,
      ignored: matcher,
    });
    watcher.on('ready', onReady); // Push on start
    watcher.on('add', onChange);
    watcher.on('change', onChange);
    watcher.on('unlink', onChange);
    watcher.on('error', err => {
      debug('Unexpected error during watch: %O', err);
    });
    return async () => {
      debug('Stopping watch');
      await watcher.close();
    };
  }

  async getChangedFiles(): Promise<ProjectFile[]> {
    const [localFiles, remoteFiles] = await Promise.all([this.collectLocalFiles(), this.fetchRemote()]);

    return localFiles.reduce((changed: ProjectFile[], localFile: ProjectFile) => {
      const remote = remoteFiles.find(f => f.localPath === localFile.localPath);
      if (!remote || remote.source !== localFile.source) {
        changed.push(localFile);
      }
      return changed;
    }, []);
  }

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
      // Save all parent paths to allow quick lookup.
      // Allows collapsing the unfiltered files to the common parent directory
      const dirs = parentDirs(file.localPath);
      dirs.forEach(dir => dirsWithIncludedFiles.add(dir));
    }

    const allFiles = await getUnfilteredLocalFiles(contentDir);
    for (const file of allFiles) {
      const resolvedPath = path.relative(cwd, file);
      if (trackedFiles.has(resolvedPath)) {
        // Tracked file, skip
        continue;
      }

      // Reduce path to nearest parent directory with no project files included
      let excludedPath = resolvedPath;
      for (const dir of parentDirs(resolvedPath)) {
        if (dirsWithIncludedFiles.has(dir)) {
          break;
        }
        excludedPath = path.normalize(`${dir}/`);
      }
      debug('Found untracked file %s', excludedPath);
      untrackedFiles.add(excludedPath);
    }

    const untrackedFilesArray = Array.from(untrackedFiles);
    untrackedFilesArray.sort((a, b) => a.localeCompare(b));
    return untrackedFilesArray;
  }

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
      if (indexA === -1 && indexB === -1) {
        // Neither has explicit order, sort by name
        return a.localPath.localeCompare(b.localPath);
      }
      if (indexA === -1) {
        // B has explicit priority, is first
        return 1;
      }
      if (indexB === -1) {
        // A has explicit priority, is first
        return -1;
      }
      // Both prioritized, use rank
      return indexA - indexB;
    });

    // Start pushing.
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

  checkMissingFilesFromPushOrder(pushedFiles: ProjectFile[]) {
    const missingFiles = [];
    for (const path of this.options.files.filePushOrder ?? []) {
      const wasPushed = pushedFiles.find(f => f.localPath === path);
      if (!wasPushed) {
        missingFiles.push(path);
      }
    }
  }

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
  const re = /Syntax error: (.+) line: (\d+) file: (.+)/;
  const [, errorName, lineNum, fileName] = re.exec(error.message) ?? [];
  if (fileName === undefined) {
    return undefined;
  }

  message = `${errorName} - "${fileName}:${lineNum}"`;
  // Get formatted code snippet
  const contextCount = 4;
  const errFile = files.find((x: ProjectFile) => x.remotePath === fileName);
  if (!errFile || !errFile.source) {
    return undefined;
  }

  const srcLines = errFile.source.split('\n');
  const errIndex = Math.max(parseInt(lineNum) - 1, 0);
  const preIndex = Math.max(errIndex - contextCount, 0);
  const postIndex = Math.min(errIndex + contextCount + 1, srcLines.length);

  const preLines = chalk.dim(`  ${srcLines.slice(preIndex, errIndex).join('\n  ')}`);
  const errLine = chalk.bold(`⇒ ${srcLines[errIndex]}`);
  const postLines = chalk.dim(`  ${srcLines.slice(errIndex + 1, postIndex).join('\n  ')}`);

  snippet = preLines + '\n' + errLine + '\n' + postLines;
  return {message, snippet};
}
