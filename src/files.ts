import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as multimatch from 'multimatch';
import { loadAPICredentials, script } from './auth';
import { DOT, DOTFILE } from './dotfile';
import {
  AppsScriptAPIFile,
  ProjectFile,
  checkConflictingFilePaths,
  getAllFiles,
  getFileContents,
  getFilePaths,
  sortFilesByPushOrder,
  transpileTsFiles,
} from './fileutils';
import { ERROR, LOG, checkIfOnline, getProjectSettings, logError, spinner } from './utils';

// Used to receive files tracked by current project
interface ProjectFilesCallback {
  error?: Error;
  projectFiles?: string[][];
  files?: Array<ProjectFile | undefined>;
}

/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/File#FileType
 */
export function getFileType(type: string, fileExtension?: string): string {
  return type === 'SERVER_JS' ? fileExtension || 'js' : type.toLowerCase();
}

/**
 * Returns true if the user has a clasp project.
 * @returns {boolean} If .clasp.json exists.
 */
export function hasProject(): boolean {
  return fs.existsSync(DOT.PROJECT.PATH);
}

/**
 * Recursively finds all files that are part of the current project, and those that are ignored
 * by .claspignore and calls the passed callback function with the file lists.
 * @param {string} rootDir The project's root directory
 */
export async function getProjectFiles(rootDir: string = path.join('.', '/')): Promise<ProjectFilesCallback> {
  const { filePushOrder } = await getProjectSettings();

  // Read all filenames as a flattened tree
  // Note: filePaths contain relative paths such as "test/bar.ts", "../../src/foo.js"
  let filePaths: string[] = await getFilePaths(rootDir);

  // Filter files that aren't allowed.
  const ignorePatterns: string[] = await DOTFILE.IGNORE();
  filePaths = filePaths.sort(); // Sort files alphanumerically
  const fileContents = await getFileContents(filePaths);
  const abortPush = await checkConflictingFilePaths(filePaths);
  if (abortPush) return await {};

  // Replace OS specific path separator to common '/' char for console output
  filePaths = filePaths.map((name) => name.replace(/\\/g, '/'));

  // check ignore files
  const ignoreMatches = multimatch(filePaths, ignorePatterns, { dot: true });

  // Loop through every file.
  let files: ProjectFile[] = await getAllFiles({
    filePaths,
    fileContents,
    ignoreMatches,
    ignoredFilePaths: [],
    nonIgnoredFilePaths: [],
    rootDir,
  });

  // Transpile TS files
  files = transpileTsFiles(files);

  // Sort files by push order
  if (filePushOrder) {
    files = sortFilesByPushOrder(files, filePushOrder);
  }

  return await {
    error: undefined,
    projectFiles: undefined,
    files: undefined,
  };
}

/**
 * Fetches the files for a project from the server
 * @param {string} scriptId The project script id
 * @param {number?} versionNumber The version of files to fetch.
 * @returns {AppsScriptAPIFile[]} Fetched files
 */
export async function fetchProject(
  scriptId: string,
  versionNumber?: number,
  silent = false,
): Promise<AppsScriptAPIFile[]> {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.start();
  let res;
  try {
    res = await script.projects.getContent({
      scriptId,
      versionNumber,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      throw Error(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }
    throw Error(ERROR.SCRIPT_ID);
  }
  spinner.stop(true);
  const data = res.data;
  if (!data.files) throw Error(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  if (!silent) console.log(LOG.CLONE_SUCCESS(data.files.length));
  return data.files as AppsScriptAPIFile[];
}

/**
 * Writes files locally to `pwd` with dots converted to subdirectories.
 * @param {AppsScriptAPIFile[]} Files to wirte
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 */
export const writeProjectFiles = async (files: AppsScriptAPIFile[], rootDir = '') => {
  const { fileExtension } = await getProjectSettings();
  const sortedFiles = files.sort((file1, file2) => file1.name.localeCompare(file2.name));
  sortedFiles.map((file: AppsScriptAPIFile) => {
    const filePath = `${file.name}.${getFileType(file.type, fileExtension)}`;
    const truePath = `${rootDir || '.'}/${filePath}`;
    mkdirp(path.dirname(truePath), err => {
      if (err) return logError(err, ERROR.FS_DIR_WRITE);
      if (!file.source) return; // disallow empty files
      fs.writeFile(truePath, file.source, err => {
        if (err) return logError(err, ERROR.FS_FILE_WRITE);
      });
      // Log only filename if pulling to root (Code.gs vs ./Code.gs)
      console.log(`└─ ${rootDir ? truePath : filePath}`);
    });
  });
};

/**
 * Pushes project files to script.google.com.
 * @param {boolean} silent If true, doesn't console.log any success message.
 */
export const pushFiles = async (silent = false) => {
  const { scriptId, rootDir } = await getProjectSettings();
  if (!scriptId) return;

  try {
    const {
      error,
      files,
    } = await getProjectFiles(rootDir);
    const filesForAPI: any = files;
    await script.projects.updateContent({
      scriptId,
      requestBody: {
        scriptId,
        files: filesForAPI,
      },
    });
    if (!silent) spinner.stop(true);
    // In the following code, we favor console.error()
    // over logError() because logError() exits, whereas
    // we want to log multiple lines of messages, and
    // eventually exit after logging everything.
    if (error) {
      console.error(LOG.PUSH_FAILURE);
      console.log(error.message);
      console.error(LOG.FILES_TO_PUSH);
      process.exit(1);
    } else if (files) {
      // no error
      if (!silent) {
        console.log(LOG.PUSH_SUCCESS(files.length));
      }
    }
  } catch (e) {
    logError(e, LOG.PUSH_FAILURE);
    spinner.stop(true);
  }
};
