/* eslint-disable new-cap */
import findUp from 'find-up';
import fs from 'fs-extra';
import mkdirp from 'mkdirp';
import multimatch from 'multimatch';
import path from 'path';
import recursive from 'recursive-readdir';
import ts2gas from 'ts2gas';
import ts from 'typescript';

import { loadAPICredentials, script } from './auth';
import { DOT, DOTFILE } from './dotfile';
import {
  checkIfOnline,
  ERROR,
  getAPIFileType,
  getProjectSettings,
  LOG,
  logError,
  PROJECT_MANIFEST_FILENAME,
  spinner,
} from './utils';
import { ReadonlyDeep } from 'type-fest';

// @see https://nodejs.org/api/fs.html#fs_fs_readfilesync_path_options
export const FS_OPTIONS = { encoding: 'utf8' };

// An Apps Script API File
interface AppsScriptFile {
  name: string;
  type: string;
  source: string;
}

// Used to receive files tracked by current project
type FilesCallback = (
  error: Error | boolean,
  result: string[][] | null,
  files: Array<AppsScriptFile | undefined> | null
) => void;

/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/File#FileType
 */
export function getFileType(type: string, fileExtension?: string): string {
  return type === 'SERVER_JS' ? fileExtension ?? 'js' : type.toLowerCase();
}

/**
 * Returns true if the user has a clasp project.
 * @returns {boolean} If .clasp.json exists.
 */
export function hasProject(): boolean {
  return fs.existsSync(DOT.PROJECT.PATH);
}

/**
 * Returns in tsconfig.json.
 * @returns {ts.TranspileOptions} if tsconfig.json not exists, return undefined.
 */
function getTranspileOptions(): ts.TranspileOptions {
  const projectPath = findUp.sync(DOT.PROJECT.PATH);
  const tsconfigPath = path.join(projectPath ? path.dirname(projectPath) : DOT.PROJECT.DIR, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    const tsconfigContent = fs.readFileSync(tsconfigPath, FS_OPTIONS);
    const parsedConfigResult = ts.parseConfigFileTextToJson(tsconfigPath, tsconfigContent);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      compilerOptions: parsedConfigResult.config.compilerOptions,
    };
  }

  return {};
}

/**
 * Recursively finds all files that are part of the current project, and those that are ignored
 * by .claspignore and calls the passed callback function with the file lists.
 * @param {string} rootDir The project's root directory
 * @param {FilesCallBack} callback The callback will be called with the following paramters
 *   error: Error if there's an error, otherwise null
 *   result: string[][], List of two lists of strings, ie. [nonIgnoredFilePaths,ignoredFilePaths]
 *   files?: Array<AppsScriptFile|undefined> Array of AppsScriptFile objects used by clasp push
 * @todo Make this function actually return a Promise that can be awaited.
 */
// eslint-disable-next-line @typescript-eslint/default-param-last
export async function getProjectFiles(rootDir: string = path.join('.', '/'), callback: FilesCallback) {
  const { filePushOrder } = await getProjectSettings();

  // Load tsconfig
  const userConf = getTranspileOptions();

  // Read all filenames as a flattened tree
  // Note: filePaths contain relative paths such as "test/bar.ts", "../../src/foo.js"
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  recursive(rootDir, async (err: ReadonlyDeep<Error>, filePaths: string[]) => {
    if (err) return callback(err, null, null);

    // Filter files that aren't allowed.
    const ignorePatterns = await DOTFILE.IGNORE();

    // Replace OS specific path separator to common '/' char for console output
    filePaths = filePaths.map((name) => name.replace(/\\/g, '/'));
    filePaths.sort((a, b) => a.localeCompare(b)); // Sort files alphanumerically

    // dispatch with patterns from .claspignore
    const filesToPush: string[] = [];
    const filesToIgnore: string[] = [];
    filePaths.forEach((file) => {
      if (multimatch(path.relative(rootDir, file), ignorePatterns, { dot: true }).length === 0) {
        filesToPush.push(file);
      } else {
        filesToIgnore.push(file);
      }
    });

    // Check if there are files that will conflict if renamed .gs to .js.
    // When pushing to Apps Script, these files will overwrite each other.
    let abortPush = false;
    filesToPush.forEach((name: string) => {
      const fileNameWithoutExt = name.slice(0, -path.extname(name).length);
      if (
        filesToPush.includes(`${fileNameWithoutExt}.js`) &&
        filesToPush.includes(`${fileNameWithoutExt}.gs`)
      ) {
        // Can't rename, conflicting files
        abortPush = true;
        // Only print error once (for .gs)
        if (path.extname(name) === '.gs') {
          logError(null, ERROR.CONFLICTING_FILE_EXTENSION(fileNameWithoutExt));
        }
      }
    });
    if (abortPush) return callback(new Error(), null, null);

    const nonIgnoredFilePaths: string[] = [];
    const ignoredFilePaths = [...filesToIgnore];

    const file2path: Array<{ path: string; file: AppsScriptFile }> = []; // Used by `filePushOrder`
    // Loop through files that are not ignored
    let files = filesToPush
      // eslint-disable-next-line array-callback-return
      .map((name) => {
        const normalizedName = path.normalize(name);

        let type = getAPIFileType(name);

        // File source
        let source = fs.readFileSync(name).toString();
        if (type === 'TS') {
          // Transpile TypeScript to Google Apps Script
          // @see github.com/grant/ts2gas
          source = ts2gas(source, userConf);
          type = 'SERVER_JS';
        }

        // Formats rootDir/appsscript.json to appsscript.json.
        // Preserves subdirectory names in rootDir
        // (rootDir/foo/Code.js becomes foo/Code.js)
        const formattedName = getAppsScriptFileName(rootDir, name);

        // If the file is valid, return the file in a format suited for the Apps Script API.
        if (isValidFileName(name, type, rootDir, normalizedName, filesToIgnore)) {
          nonIgnoredFilePaths.push(name);
          const file: AppsScriptFile = {
            name: formattedName, // The file base name
            type, // The file extension
            source, // The file contents
          };
          file2path.push({ file, path: name }); // Allow matching of nonIgnoredFilePaths and files arrays
          return file;
        }

        ignoredFilePaths.push(name);
        return undefined; // Kludgy. Skip ignored files
      })
      .filter(Boolean); // Remove null values

    // This statement customizes the order in which the files are pushed.
    // It puts the files in the setting's filePushOrder first.
    // This is needed because Apps Script blindly executes files in order of creation time.
    // The Apps Script API updates the creation time of files.
    if (filePushOrder && filePushOrder.length > 0) {
      // Skip "filePushOrder": []
      if (spinner.isSpinning()) spinner.stop(true);
      console.log('Detected filePushOrder setting. Pushing these files first:');
      logFileList(filePushOrder);
      console.log('');
      nonIgnoredFilePaths.sort((path1, path2) => {
        // Get the file order index
        let path1Index = filePushOrder.indexOf(path1);
        let path2Index = filePushOrder.indexOf(path2);
        // If a file path isn't in the filePushOrder array, set the order to +∞.
        path1Index = path1Index === -1 ? Number.POSITIVE_INFINITY : path1Index;
        path2Index = path2Index === -1 ? Number.POSITIVE_INFINITY : path2Index;
        return path1Index - path2Index;
      });
      // Apply nonIgnoredFilePaths sort order to files
      files = (files as AppsScriptFile[]).sort((file1, file2) => {
        // Get the file path from file2path
        const path1 = file2path.find((element) => element.file === file1);
        const path2 = file2path.find((element) => element.file === file2);
        // If a file path isn't in the nonIgnoredFilePaths array, set the order to +∞.
        const path1Index = path1 ? nonIgnoredFilePaths.indexOf(path1.path) : Number.POSITIVE_INFINITY;
        const path2Index = path2 ? nonIgnoredFilePaths.indexOf(path2.path) : Number.POSITIVE_INFINITY;
        return path1Index - path2Index;
      });
    }

    callback(false, [nonIgnoredFilePaths, ignoredFilePaths], files);
  });
}

/**
 * If the file is valid, add it to our file list.
 * We generally want to allow for all file types, including files in node_modules/.
 * However, node_modules/@types/ files should be ignored.
 */
export function isValidFileName(
  name: string,
  type: string,
  rootDir: string,
  normalizedName: string,
  ignoreMatches: readonly string[]
): boolean {
  let valid = true; // Valid by default, until proven otherwise.
  // Has a type or is appsscript.json
  let isValidJSONIfJSON = true;
  if (type === 'JSON') {
    isValidJSONIfJSON = rootDir
      ? normalizedName === path.join(rootDir, PROJECT_MANIFEST_FILENAME)
      : name === PROJECT_MANIFEST_FILENAME;
  } else {
    // Must be SERVER_JS or HTML.
    // https://developers.google.com/apps-script/api/reference/rest/v1/File
    valid = type === 'SERVER_JS' || type === 'HTML';
  }

  // Prevent node_modules/@types/
  if (name.includes('node_modules/@types')) {
    return false;
  }

  const validType = type && isValidJSONIfJSON;
  const notIgnored = !ignoreMatches.includes(name);
  valid = Boolean(valid && validType && notIgnored);
  return valid;
}

/**
 * Gets the name of the file for Apps Script.
 * Formats rootDir/appsscript.json to appsscript.json.
 * Preserves subdirectory names in rootDir
 * (rootDir/foo/Code.js becomes foo/Code.js)
 * @param {string} rootDir The directory to save the project files to.
 * @param {string} filePath Path of file that is part of the current project
 */
export function getAppsScriptFileName(rootDir: string, filePath: string) {
  const nameWithoutExt = filePath.slice(0, -path.extname(filePath).length);
  let fullFilePathNoExt = rootDir ? path.relative(rootDir, nameWithoutExt) : nameWithoutExt;
  // Replace OS specific path separator to common '/' char
  fullFilePathNoExt = fullFilePathNoExt.replace(/\\/g, '/');
  return fullFilePathNoExt;
}

/**
 * Fetches the files for a project from the server
 * @param {string} scriptId The project script id
 * @param {number?} versionNumber The version of files to fetch.
 * @returns {AppsScriptFile[]} Fetched files
 */
export async function fetchProject(
  scriptId: string,
  versionNumber?: number,
  silent = false
): Promise<AppsScriptFile[]> {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.start();
  let response;
  try {
    response = await script.projects.getContent({
      scriptId,
      versionNumber,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      throw new Error(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }

    throw new Error(ERROR.SCRIPT_ID);
  }

  if (spinner.isSpinning()) spinner.stop(true);
  const { data } = response;
  if (!data.files) throw new Error(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  if (!silent) console.log(LOG.CLONE_SUCCESS(data.files.length));
  return data.files as AppsScriptFile[];
}

/**
 * Writes files locally to `pwd` with dots converted to subdirectories.
 * @param {AppsScriptFile[]} Files to wirte
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 */
export async function writeProjectFiles(files: AppsScriptFile[], rootDir = '') {
  const { fileExtension } = await getProjectSettings();
  // ? following statement mutates variable `files`. Is that desirable?
  files.sort((file1, file2) => file1.name.localeCompare(file2.name));
  const sortedFiles = files;
  sortedFiles.forEach((file) => {
    const filePath = `${file.name}.${getFileType(file.type, fileExtension)}`;
    const truePath = `${rootDir || '.'}/${filePath}`;
    mkdirp(path.dirname(truePath))
      // eslint-disable-next-line promise/prefer-await-to-then
      .then(() => {
        if (!file.source) return; // Disallow empty files
        fs.writeFile(truePath, file.source, (err: Readonly<NodeJS.ErrnoException>) => {
          if (err) logError(err, ERROR.FS_FILE_WRITE);
        });
        // Log only filename if pulling to root (Code.gs vs ./Code.gs)
        console.log(`└─ ${rootDir ? truePath : filePath}`);
      })
      .catch((error) => logError(error, ERROR.FS_DIR_WRITE));
  });
}

/**
 * Pushes project files to script.google.com.
 * @param {boolean} silent If true, doesn't console.log any success message.
 */
export async function pushFiles(silent = false) {
  const { scriptId, rootDir } = await getProjectSettings();
  if (!scriptId) return;
  // TODO Make getProjectFiles async
  await getProjectFiles(rootDir, async (err, projectFiles, files = []) => {
    // Check for edge cases.
    if (err) {
      if (spinner.isSpinning()) spinner.stop(true);
      logError(err, LOG.PUSH_FAILURE);
    }

    if (!projectFiles) {
      console.log(LOG.PUSH_NO_FILES);
      if (spinner.isSpinning()) spinner.stop(true);
      return;
    }

    // Start pushing.
    const [nonIgnoredFilePaths] = projectFiles;
    const filesForAPI = files as AppsScriptFile[];
    try {
      await script.projects.updateContent({
        scriptId,
        requestBody: {
          scriptId,
          files: filesForAPI,
        },
      });
    } catch (error) {
      console.error(LOG.PUSH_FAILURE);
      console.error(error);
    } finally {
      if (spinner.isSpinning()) spinner.stop(true);
      // No error
      if (!silent) {
        logFileList(nonIgnoredFilePaths);
        console.log(LOG.PUSH_SUCCESS(nonIgnoredFilePaths.length));
      }
    }
  });
}

export const logFileList = (files: readonly string[]) =>
  console.log(files.map((file) => `└─ ${file}`).join('\n'));
