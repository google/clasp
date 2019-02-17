import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as multimatch from 'multimatch';
import { loadAPICredentials, script } from './auth';
import { DOT, DOTFILE } from './dotfile';
import {
  AppsScriptAPIFile,
  File,
  fixFilePaths,
  getAllFilePaths,
  getFileContents,
  getValidFilePaths,
  removeExtensionFromName,
  sortFilesByPushOrder,
  transpileTsFiles,
} from './fileutils';
import {
  ERROR,
  LOG,
  checkIfOnline,
  getProjectSettings,
  logError,
  spinner,
} from './utils';

/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/File#FileType
 */
export function getFileType(type: string, fileExtension?: string): string {
  throw Error('TODO');
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

  // Little util for messaging during the process of pushing.
  const m = (text: string) => {
    if (!silent) {
      console.log(text);
    }
  };
  try {
    // Get all file paths.
    m(LOG.PUSHING);
    const filePaths = await getAllFilePaths(rootDir || '.');
    const validFilePaths = await getValidFilePaths(filePaths);
    m(LOG.PUSHING_DETECTED_VALID_FILES(validFilePaths.length));

    // Get ignore patterns.
    const ignorePatterns: string[] = await DOTFILE.IGNORE();
    m(LOG.PUSHING_IGNORE_PATTERNS(ignorePatterns.length));

    // Filter out paths that match patterns.
    const ignoreMatches = multimatch(validFilePaths, ignorePatterns, { dot: true });
    m(LOG.PUSHING_IGNORE_MATCHES(ignoreMatches.length));

    // Get non-filtered paths
    const nonIgnoreMatches = validFilePaths.filter((p) => {
      return ignoreMatches.indexOf(p) === -1;
    });
    console.log(nonIgnoreMatches);

    // Get all file contents
    const fileContents = await getFileContents(nonIgnoreMatches);
    const fixedFileContents = await fixFilePaths(fileContents);
    const sortedFixedFileContents = await sortFilesByPushOrder(fixedFileContents);
    const transpiledSortedFixedFileContents = await transpileTsFiles(sortedFixedFileContents);
    const finalContents = await removeExtensionFromName(transpiledSortedFixedFileContents);

    // Organize the files into an array for the server.
    const filesForAPI = finalContents.map((f: File) => {
      return {
        name: f.name,
        source: f.content,
        type: f.name,
      };
    });
    console.log(filesForAPI);

    // Make the request to the server.
    await script.projects.updateContent({
      scriptId,
      requestBody: {
        scriptId,
        files: filesForAPI,
      },
    });
    // if (!silent) spinner.stop(true);
    // // In the following code, we favor console.error()
    // // over logError() because logError() exits, whereas
    // // we want to log multiple lines of messages, and
    // // eventually exit after logging everything.
    // if (error) {
    //   console.error(LOG.PUSH_FAILURE);
    //   console.log(error.message);
    //   console.error(LOG.FILES_TO_PUSH);
    //   process.exit(1);
    // } else if (files) {
    //   // no error
    //   if (!silent) {
    //     console.log(LOG.PUSH_SUCCESS(files.length));
    //   }
    // }
  } catch (e) {
    console.error(LOG.PUSH_FAILURE);
    console.error(e.errors);
    spinner.stop(true);
  }
};
