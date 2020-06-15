import findUp from 'find-up';
import fs from 'fs-extra';
import mkdirp from 'mkdirp';
import multimatch from 'multimatch';
import path from 'path';
import recursive from 'recursive-readdir';
import ts2gas from 'ts2gas';
import {ReadonlyDeep} from 'type-fest';
import ts from 'typescript';

import {loadAPICredentials, script} from './auth';
import {ClaspError} from './clasp-error';
import {FS_OPTIONS, PROJECT_MANIFEST_FILENAME} from './constants';
import {DOT, DOTFILE} from './dotfile';
import {ERROR, LOG} from './messages';
import {checkIfOnline, getApiFileType, getErrorMessage, getProjectSettings, spinner, stopSpinner} from './utils';

// An Apps Script API File
interface AppsScriptFile {
  readonly name: string;
  readonly type: string;
  readonly source: string;
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
export const getFileType = (type: string, fileExtension?: string): string =>
  type === 'SERVER_JS' ? fileExtension ?? 'js' : type.toLowerCase();

/**
 * Returns true if the user has a clasp project.
 * @returns {boolean} If .clasp.json exists.
 */
export const hasProject = (): boolean => fs.existsSync(DOT.PROJECT.PATH);

/**
 * Returns in tsconfig.json.
 * @returns {ts.TranspileOptions} if tsconfig.json not exists, return undefined.
 */
const getTranspileOptions = (): ts.TranspileOptions => {
  const projectPath = findUp.sync(DOT.PROJECT.PATH);
  const tsconfigPath = path.join(projectPath ? path.dirname(projectPath) : DOT.PROJECT.DIR, 'tsconfig.json');

  return fs.existsSync(tsconfigPath)
    ? {
        compilerOptions: ts.parseConfigFileTextToJson(tsconfigPath, fs.readFileSync(tsconfigPath, FS_OPTIONS)).config
          .compilerOptions,
      }
    : {};
};

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
export const getProjectFiles = async (rootDir: string = path.join('.', '/'), callback: FilesCallback) => {
  const {filePushOrder} = await getProjectSettings();

  // Load tsconfig
  const userConf = getTranspileOptions();

  // Read all filenames as a flattened tree
  // Note: filePaths contain relative paths such as "test/bar.ts", "../../src/foo.js"
  recursive(rootDir, async (err: ReadonlyDeep<Error>, filePaths: string[]) => {
    if (err) return callback(err, null, null);

    // Filter files that aren't allowed.
    const ignorePatterns = await DOTFILE.IGNORE();

    // Replace OS specific path separator to common '/' char for console output
    filePaths = filePaths.map(name => name.replace(/\\/g, '/'));
    filePaths.sort((a, b) => a.localeCompare(b)); // Sort files alphanumerically

    // dispatch with patterns from .claspignore
    const filesToPush: string[] = [];
    const filesToIgnore: string[] = [];
    filePaths.forEach(file => {
      if (multimatch(path.relative(rootDir, file), ignorePatterns, {dot: true}).length === 0) {
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
      if (filesToPush.includes(`${fileNameWithoutExt}.js`) && filesToPush.includes(`${fileNameWithoutExt}.gs`)) {
        // Can't rename, conflicting files
        abortPush = true;
        // Only print error once (for .gs)
        if (path.extname(name) === '.gs') {
          throw new ClaspError(ERROR.CONFLICTING_FILE_EXTENSION(fileNameWithoutExt));
        }
      }
    });
    if (abortPush) return callback(new Error(), null, null);

    const nonIgnoredFilePaths: string[] = [];
    const ignoredFilePaths = [...filesToIgnore];

    const file2path: Array<{path: string; file: AppsScriptFile}> = []; // Used by `filePushOrder`
    // Loop through files that are not ignored
    let files = filesToPush
      .map(name => {
        const normalizedName = path.normalize(name);

        let type = getApiFileType(name);

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
          file2path.push({file, path: name}); // Allow matching of nonIgnoredFilePaths and files arrays
          return file;
        }

        ignoredFilePaths.push(name);
        return; // Kludgy. Skip ignored files
      })
      .filter(Boolean); // Remove null values

    // This statement customizes the order in which the files are pushed.
    // It puts the files in the setting's filePushOrder first.
    // This is needed because Apps Script blindly executes files in order of creation time.
    // The Apps Script API updates the creation time of files.
    if (filePushOrder && filePushOrder.length > 0) {
      // Skip "filePushOrder": []
      stopSpinner();

      console.log('Detected filePushOrder setting. Pushing these files first:');
      logFileList(filePushOrder);
      console.log('');

      nonIgnoredFilePaths.sort((path1, path2) => {
        // Get the file order index
        const path1Index = filePushOrder.indexOf(path1);
        const path2Index = filePushOrder.indexOf(path2);

        // If a file path isn't in the filePushOrder array, set the order to +∞.
        return (
          (path1Index === -1 ? Number.POSITIVE_INFINITY : path1Index) -
          (path2Index === -1 ? Number.POSITIVE_INFINITY : path2Index)
        );
      });

      // Apply nonIgnoredFilePaths sort order to files
      files = (files as AppsScriptFile[]).sort((file1, file2) => {
        // Get the file path from file2path
        const path1 = file2path.find(element => element.file === file1);
        const path2 = file2path.find(element => element.file === file2);

        // If a file path isn't in the nonIgnoredFilePaths array, set the order to +∞.
        return (
          (path1 ? nonIgnoredFilePaths.indexOf(path1.path) : Number.POSITIVE_INFINITY) -
          (path2 ? nonIgnoredFilePaths.indexOf(path2.path) : Number.POSITIVE_INFINITY)
        );
      });
    }

    callback(false, [nonIgnoredFilePaths, ignoredFilePaths], files);
  });
};

/**
 * If the file is valid, add it to our file list.
 * We generally want to allow for all file types, including files in node_modules/.
 * However, node_modules/@types/ files should be ignored.
 */
export const isValidFileName = (
  name: string,
  type: string,
  rootDir: string,
  normalizedName: string,
  ignoreMatches: readonly string[]
): boolean =>
  Boolean(
    !name.includes('node_modules/@types') && // Prevent node_modules/@types/
      (type === 'JSON' // Has a type or is appsscript.json
        ? rootDir
          ? normalizedName === path.join(rootDir, PROJECT_MANIFEST_FILENAME)
          : name === PROJECT_MANIFEST_FILENAME
        : type === 'SERVER_JS' || type === 'HTML') &&
      !ignoreMatches.includes(name) // Must be SERVER_JS or HTML. https://developers.google.com/apps-script/api/reference/rest/v1/File
  );

/**
 * Gets the name of the file for Apps Script.
 * Formats rootDir/appsscript.json to appsscript.json.
 * Preserves subdirectory names in rootDir
 * (rootDir/foo/Code.js becomes foo/Code.js)
 * @param {string} rootDir The directory to save the project files to.
 * @param {string} filePath Path of file that is part of the current project
 */
export const getAppsScriptFileName = (rootDir: string, filePath: string) => {
  const nameWithoutExt = filePath.slice(0, -path.extname(filePath).length);

  // Replace OS specific path separator to common '/' char
  return (rootDir ? path.relative(rootDir, nameWithoutExt) : nameWithoutExt).replace(/\\/g, '/');
};

/**
 * Fetches the files for a project from the server
 * @param {string} scriptId The project script id
 * @param {number?} versionNumber The version of files to fetch.
 * @returns {AppsScriptFile[]} Fetched files
 */
export const fetchProject = async (
  scriptId: string,
  versionNumber?: number,
  silent = false
): Promise<AppsScriptFile[]> => {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.start();
  let response;
  try {
    response = await script.projects.getContent({scriptId, versionNumber});
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    if (error.statusCode === 404) {
      throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }

    throw new ClaspError(ERROR.SCRIPT_ID);
  }

  stopSpinner();

  const {files} = response.data;
  if (!files) {
    throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  }

  if (!silent) {
    console.log(LOG.CLONE_SUCCESS(files.length));
  }

  return files as AppsScriptFile[];
};

/**
 * Writes files locally to `pwd` with dots converted to subdirectories.
 * @param {AppsScriptFile[]} Files to wirte
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 */
export const writeProjectFiles = async (files: AppsScriptFile[], rootDir = '') => {
  try {
    const {fileExtension} = await getProjectSettings();

    const fileList = files.filter(file => file.source); // Disallow empty files
    fileList.sort((a, b) => a.name.localeCompare(b.name));

    for await (const file of fileList) {
      const filePath = `${file.name}.${getFileType(file.type, fileExtension)}`;
      const truePath = `${rootDir || '.'}/${filePath}`;
      await mkdirp(path.dirname(truePath));
      fs.writeFile(truePath, file.source, (error: Readonly<NodeJS.ErrnoException>) => {
        if (error) {
          throw new ClaspError(getErrorMessage(error) ?? ERROR.FS_FILE_WRITE);
        }
      });
      // Log only filename if pulling to root (Code.gs vs ./Code.gs)
      console.log(`└─ ${rootDir ? truePath : filePath}`);
    }
  } catch (error) {
    if (error instanceof ClaspError) {
      throw error;
    }

    throw new ClaspError(getErrorMessage(error) ?? ERROR.FS_DIR_WRITE);
  }
};

/**
 * Pushes project files to script.google.com.
 * @param {boolean} silent If true, doesn't console.log any success message.
 */
export const pushFiles = async (silent = false) => {
  const {scriptId, rootDir} = await getProjectSettings();
  if (scriptId) {
    const asyncCallback: FilesCallback = async (error, projectFiles, files = []) => {
      // Check for edge cases.
      if (error) {
        if (error instanceof ClaspError) {
          throw error;
        }

        throw new ClaspError(getErrorMessage(error) ?? LOG.PUSH_FAILURE);
      }

      if (projectFiles) {
        // Start pushing.
        const [nonIgnoredFilePaths] = projectFiles;
        try {
          await script.projects.updateContent({
            scriptId,
            requestBody: {
              scriptId,
              files: files as AppsScriptFile[],
            },
          });
        } catch (error) {
          console.error(LOG.PUSH_FAILURE);
          console.error(error);
        } finally {
          stopSpinner();

          // No error
          if (!silent) {
            logFileList(nonIgnoredFilePaths);
            console.log(LOG.PUSH_SUCCESS(nonIgnoredFilePaths.length));
          }
        }
      } else {
        console.log(LOG.PUSH_NO_FILES);
        stopSpinner();
      }
    };

    await getProjectFiles(rootDir, asyncCallback);
  }
};

export const logFileList = (files: readonly string[]) => console.log(files.map(file => `└─ ${file}`).join('\n'));
