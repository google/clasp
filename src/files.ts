import path from 'path';
import chalk from 'chalk';
import {fdir} from 'fdir';
import fs from 'fs-extra';
import {google} from 'googleapis';
import {GaxiosError, OAuth2Client} from 'googleapis-common';
import {makeDirectory} from 'make-dir';
import multimatch from 'multimatch';
import normalizePath from 'normalize-path';
import pMap from 'p-map';
import {ClaspError} from './clasp-error.js';
import {Project} from './context.js';
import {ERROR, LOG} from './messages.js';
import {getApiFileType} from './utils.js';

// An Apps Script API File
interface AppsScriptFile {
  readonly name: string;
  readonly source: string;
  readonly type: string;
}

interface ProjectFile {
  readonly isIgnored: boolean;
  readonly localPath: string;
  readonly remotePath?: string;
  readonly source?: string;
  readonly type?: string;
}

function isValidFileType(file: Pick<ProjectFile, 'localPath' | 'type'>) {
  if (file.type === 'JSON' && path.basename(file.localPath) === 'appsscript.json') {
    return true;
  }
  return file.type === 'SERVER_JS' || file.type === 'HTML';
}

async function projectFileWithContent(rootDir: string, file: Pick<ProjectFile, 'localPath'>): Promise<ProjectFile> {
  const type = getApiFileType(file.localPath);

  if (!isValidFileType({localPath: file.localPath, type})) {
    return {...file, type, source: '', isIgnored: true};
  }

  const remotePath = getAppsScriptFileName(rootDir, file.localPath);
  const content = await fs.readFile(file.localPath);
  const source = content.toString();

  return {...file, remotePath, source, type, isIgnored: false};
}

function ignoredProjectFile(file: Pick<ProjectFile, 'localPath'>): ProjectFile {
  return {...file, source: '', isIgnored: true, type: ''};
}

async function getCandidateFiles(rootDir: string, recursive: boolean) {
  let fdirBuilder = new fdir().withBasePath();
  if (!recursive) {
    fdirBuilder = fdirBuilder.withMaxDepth(1);
  }
  const files = await fdirBuilder.crawl(rootDir).withPromise();
  files.sort((a, b) => a.localeCompare(b));
  return files[Symbol.iterator]();
}

/**
 * Return an array of `ProjectFile` objects
 *
 * Recursively finds all files that are part of the current project, including those that are ignored by .claspignore
 *
 * > Note: content for each file is not returned. Use `getContentOfProjectFiles()` on the resulting array.
 *
 * @param rootDir the project's `rootDir`
 */
export async function getAllProjectFiles(
  rootDir: string,
  ignorePatterns: string[],
  recursive: boolean,
): Promise<ProjectFile[]> {
  const isIgnored = (file: string) => {
    file = path.relative(rootDir, file);
    if (file.includes('node_modules/@types')) {
      return true;
    }
    return multimatch(file, ignorePatterns, {dot: true}).length > 0;
  };

  // Read all filenames as a flattened tree
  // Note: filePaths contain relative paths such as "test/bar.ts", "../../src/foo.js"
  const filelist = await getCandidateFiles(rootDir, recursive);
  const duplicateCheck = new Set<string>();

  const files = Promise.all(
    filelist
      .map(async filename => {
        // Replace OS specific path separator to common '/' char for console output
        const name = normalizePath(path.relative(process.cwd(), filename));
        if (isIgnored(name)) {
          return ignoredProjectFile({localPath: name});
        }
        return await projectFileWithContent(rootDir, {localPath: name});
      })
      .map(async file => {
        // Check for naming conflicts
        const f = await file;
        if (f.isIgnored) {
          return f;
        }
        if (f.type !== 'SERVER_JS') {
          return f;
        }
        const parsedPath = path.parse(f.localPath);
        const key = path.format({dir: parsedPath.dir, name: parsedPath.name});
        if (duplicateCheck.has(key)) {
          throw new ClaspError(ERROR.CONFLICTING_FILE_EXTENSION(key));
        }
        return f;
      }),
  );
  return files;
}

export function splitProjectFiles(files: ProjectFile[]): [ProjectFile[], ProjectFile[]] {
  return files.reduce(
    (prev, file) => {
      // ignored files go in the second array
      const index = file.isIgnored ? 1 : 0;
      prev[index].push(file);
      return prev;
    },
    [[] as ProjectFile[], [] as ProjectFile[]],
  );
}

async function getAppsScriptFilesFromProjectFiles(files: ProjectFile[]) {
  return files.map(file => ({
    name: file.remotePath,
    source: file.source,
    type: file.type,
  }));
}

// This statement customizes the order in which the files are pushed.
// It puts the files in the setting's filePushOrder first.
// This is needed because Apps Script blindly executes files in order of creation time.
// The Apps Script API updates the creation time of files.
export function getOrderedProjectFiles(files: ProjectFile[], filePushOrder: string[] | undefined) {
  const orderedFiles = [...files];

  if (filePushOrder && filePushOrder.length > 0) {
    console.log('Detected filePushOrder setting. Pushing these files first:');
    logFileList(filePushOrder);
    console.log('');

    orderedFiles.sort((a, b) => {
      // Get the file order index
      const indexA = filePushOrder.indexOf(a.localPath);
      const indexB = filePushOrder.indexOf(b.localPath);

      // If a file path isn't in the filePushOrder array, set the order to +∞.
      return (indexA > -1 ? indexA : Number.POSITIVE_INFINITY) - (indexB > -1 ? indexB : Number.POSITIVE_INFINITY);
    });
  }

  return orderedFiles;
}

// // Used to receive files tracked by current project
// type FilesCallback = (error: Error | boolean, result: [string[], string[]], files: Array<AppsScriptFile>) => void;

/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/File#FileType
 */
function getLocalFileType(type: string, fileExtension?: string): string {
  return type === 'SERVER_JS' ? (fileExtension ?? 'js') : type.toLowerCase();
}

/**
 * Gets the name of the file for Apps Script.
 * Formats rootDir/appsscript.json to appsscript.json.
 * Preserves subdirectory names in rootDir
 * (rootDir/foo/Code.js becomes foo/Code.js)
 * @param {string} filePath Path of file that is part of the current project
 */
export function getAppsScriptFileName(rootDir: string, filePath: string) {
  const resolvedPath = path.relative(rootDir, filePath);
  const parsedPath = path.parse(resolvedPath);
  return path.format({dir: parsedPath.dir, name: parsedPath.name});
}

/**
 * Fetches the files for a project from the server
 * @param {string} scriptId The project script id
 * @param {number?} versionNumber The version of files to fetch.
 * @returns {AppsScriptFile[]} Fetched files
 */
export async function fetchProject(
  oauth2Client: OAuth2Client,
  scriptId: string,
  versionNumber?: number,
): Promise<AppsScriptFile[]> {
  const script = google.script({version: 'v1', auth: oauth2Client});

  let response;
  try {
    response = await script.projects.getContent({scriptId, versionNumber});
  } catch (error) {
    if ((error as GaxiosError).status === 404) {
      throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }
    throw new ClaspError(ERROR.SCRIPT_ID);
  }

  const {files} = response.data;
  if (!files) {
    throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  }

  return files as AppsScriptFile[];
}

/**
 * Writes files locally to `pwd` with dots converted to subdirectories.
 * @param {AppsScriptFile[]} Files to write
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 */
export async function writeProjectFiles(files: AppsScriptFile[], project: Project) {
  try {
    const mapper = async (file: AppsScriptFile) => {
      const filePath = `${file.name}.${getLocalFileType(file.type, project.settings.fileExtension)}`;
      const truePath = `${project.contentDir}/${filePath}`;
      await makeDirectory(path.dirname(truePath));
      await fs.writeFile(truePath, file.source);
      return truePath;
    };

    const fileList = files.filter(file => file.source); // Disallow empty files
    fileList.sort((a, b) => a.name.localeCompare(b.name));

    return await pMap(fileList, mapper);
  } catch {
    throw new ClaspError(ERROR.FS_DIR_WRITE);
  }
}

/**
 * Pushes project files to script.google.com.
 * @param {boolean} silent If true, doesn't console.log any success message.
 */
export async function pushFiles(oauth2Client: OAuth2Client, project: Project, silent = false) {
  const [toPush] = splitProjectFiles(
    await getAllProjectFiles(project.contentDir, project.ignorePatterns, project.recursive),
  );

  if (toPush.length === 0) {
    console.log(LOG.PUSH_NO_FILES);
    return;
  }

  const orderedFiles = getOrderedProjectFiles(toPush, project.settings.filePushOrder);
  const files = await getAppsScriptFilesFromProjectFiles(orderedFiles);
  const filenames = orderedFiles.map(file => file.localPath);

  // Start pushing.
  try {
    const script = google.script({version: 'v1', auth: oauth2Client});
    await script.projects.updateContent({
      scriptId: project.settings.scriptId,
      requestBody: {
        scriptId: project.settings.scriptId,
        files,
      },
    });

    if (!silent) {
      logFileList(filenames);
      console.log(LOG.PUSH_SUCCESS(filenames.length));
    }
  } catch (error) {
    console.error(LOG.PUSH_FAILURE);
    if (error instanceof GaxiosError) {
      const {message, snippet} = extractScriptError(error, orderedFiles);
      console.error(chalk.red(message));
      if (snippet) {
        console.log(snippet);
      }
    }
    throw new ClaspError('Push failed.');
  }
}

function extractScriptError(error: GaxiosError, files: ProjectFile[]) {
  let message = error.message;
  let snippet = '';
  const re = /Syntax error: (.+) line: (\d+) file: (.+)/;
  const [, errorName, lineNum, fileName] = re.exec(error.message) ?? [];
  if (fileName === undefined) {
    return {message};
  }

  message = `${errorName} - "${fileName}:${lineNum}"`;
  // Get formatted code snippet
  const contextCount = 4;
  const errFile = files.find((x: ProjectFile) => x.remotePath === fileName);
  if (!errFile || !errFile.source) {
    return {message};
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

export function logFileList(files: readonly string[]) {
  return console.log(files.map(file => `└─ ${file}`).join('\n'));
}
