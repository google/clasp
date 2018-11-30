import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as multimatch from 'multimatch';
import * as path from 'path';
import * as recursive from 'recursive-readdir';
import { prompt } from 'inquirer';
import { loadAPICredentials, script } from './auth';
import { DOT, DOTFILE } from './dotfile';
import { checkIfOnline, ERROR, getAPIFileType, getProjectSettings, LOG, logError, spinner } from './utils';
import { readManifest, readRemoteManifest } from './manifest';

const ts2gas = require('ts2gas');
const readMultipleFiles = require('read-multiple-files');
const deepEqual = require('deep-equal');

// An Apps Script API File
interface AppsScriptFile {
  name: string;
  type: string;
  source: string;
}

// Used to receive files tracked by current project
interface FilesCallback {
  (error: Error | boolean, result: string[][] | null, files: Array<AppsScriptFile | undefined> | null): void;
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
 * @param {FilesCallBack} callback The callback will be called with the following paramters
 *   error: Error if there's an error, otherwise null
 *   result: string[][], List of two lists of strings, ie. [nonIgnoredFilePaths,ignoredFilePaths]
 *   files?: Array<AppsScriptFile|undefined> Array of AppsScriptFile objects used by clasp push
 */
export async function getProjectFiles(rootDir: string = path.join('.', '/'), callback: FilesCallback) {
  const { filePushOrder } = await getProjectSettings();
  // Read all filenames as a flattened tree
  // Note: filePaths contain relative paths such as "test/bar.ts", "../../src/foo.js"
  recursive(rootDir, (err, filePaths) => {
    if (err) return callback(err, null, null);
    // Filter files that aren't allowed.
    DOTFILE.IGNORE().then((ignorePatterns: string[]) => {
      filePaths = filePaths.sort(); // Sort files alphanumerically
      let abortPush = false;
      let nonIgnoredFilePaths: string[] = [];
      const ignoredFilePaths: string[] = [];
      // Match the files with ignored glob pattern
      readMultipleFiles(filePaths, 'utf8', (err: string, contents: string[]) => {
        if (err) return callback(new Error(err), null, null);
        // Check if there are files that will conflict if renamed .gs to .js.
        // When pushing to Apps Script, these files will overwrite each other.
        filePaths.map((name: string) => {
          const fileNameWithoutExt = name.slice(0, -path.extname(name).length);
          if (
            filePaths.indexOf(fileNameWithoutExt + '.js') !== -1 &&
            filePaths.indexOf(fileNameWithoutExt + '.gs') !== -1
          ) {
            // Can't rename, conflicting files
            abortPush = true;
            if (path.extname(name) === '.gs') {
              // only print error once (for .gs)
              logError(null, ERROR.CONFLICTING_FILE_EXTENSION(fileNameWithoutExt));
            }
          }
        });
        if (abortPush) return callback(new Error(), null, null);

        // check ignore files
        const ignoreMatches = multimatch(filePaths, ignorePatterns);

        // Loop through every file.
        const files = filePaths
          .map((name, i) => {
            // Replace OS specific path separator to common '/' char for console output
            name = name.replace(/\\/g, '/');

            let type = getAPIFileType(name);

            // File source
            let source = contents[i];
            if (type === 'TS') {
              // Transpile TypeScript to Google Apps Script
              // @see github.com/grant/ts2gas
              source = ts2gas(source);
              type = 'SERVER_JS';
            }

            // Formats rootDir/appsscript.json to appsscript.json.
            // Preserves subdirectory names in rootDir
            // (rootDir/foo/Code.js becomes foo/Code.js)
            const formattedName = getAppsScriptFileName(rootDir, name);

            /**
             * If the file is valid, add it to our file list.
             * We generally want to allow for all file types, including files in node_modules/.
             * However, node_modules/@types/ files should be ignored.
             */
            const isValidFileName = (name: string) => {
              let valid = true; // Valid by default, until proven otherwise.
              // Has a type or is appsscript.json
              let isValidJSONIfJSON = true;
              if (type === 'JSON') {
                if (rootDir) {
                  isValidJSONIfJSON = name === path.join(rootDir, 'appsscript.json');
                } else {
                  isValidJSONIfJSON = name === 'appsscript.json';
                }
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
              valid = !!(valid && validType && notIgnored);
              return valid;
            };

            // If the file is valid, return the file in a format suited for the Apps Script API.
            if (isValidFileName(name)) {
              nonIgnoredFilePaths.push(name);
              const file: AppsScriptFile = {
                name: formattedName, // the file base name
                type, // the file extension
                source, //the file contents
              };
              return file;
            } else {
              ignoredFilePaths.push(name);
              return; // Skip ignored files
            }
          })
          .filter(Boolean); // remove null values

        // This statement customizes the order in which the files are pushed.
        // It puts the files in the setting's filePushOrder first.
        // This is needed because Apps Script blindly executes files in order of creation time.
        // The Apps Script API updates the creation time of files.
        if (filePushOrder) {
          spinner.stop(true);
          console.log('Detected filePushOrder setting. Pushing these files first:');
          filePushOrder.map(file => {
            console.log(`└─ ${file}`);
          });
          console.log('');
          nonIgnoredFilePaths = nonIgnoredFilePaths.sort((path1: string, path2: string) => {
            // Get the file order index
            let path1Index = filePushOrder.indexOf(path1);
            let path2Index = filePushOrder.indexOf(path2);
            // If a file path isn't in the filePushOrder array, set the order to -∞.
            path1Index = path1Index === -1 ? Number.NEGATIVE_INFINITY : path1Index;
            path2Index = path2Index === -1 ? Number.NEGATIVE_INFINITY : path2Index;
            return path2Index - path1Index;
          });
        }

        callback(false, [nonIgnoredFilePaths, ignoredFilePaths], files);
      });
    });
  });
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
 * Fetches the files for a project from the server and writes files locally to
 * `pwd` with dots converted to subdirectories.
 * @param {string} scriptId The project script id
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 * @param {number?} versionNumber The version of files to fetch.
 */
export async function fetchProject(scriptId: string, rootDir = '', versionNumber?: number) {
  await checkIfOnline();
  await loadAPICredentials();
  const { fileExtension } = await getProjectSettings();
  spinner.start();
  script.projects.getContent(
    {
      scriptId,
      versionNumber,
    },
    {},
    (error: any, res: any) => {
      spinner.stop(true);
      if (error) {
        if (error.statusCode === 404) return logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
        return logError(error, ERROR.SCRIPT_ID);
      } else {
        const data = res.data;
        if (!data.files) {
          return logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
        }
        // Create the files in the cwd
        console.log(LOG.CLONE_SUCCESS(data.files.length));
        const sortedFiles = data.files.sort((file: AppsScriptFile) => file.name);
        sortedFiles.map((file: AppsScriptFile) => {
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
      }
    },
  );
}

/**
 * Pushes project files to script.google.com.
 */
export async function pushFiles(force:boolean) {
  const { scriptId, rootDir } = await getProjectSettings();
  if (!scriptId) return;
  getProjectFiles(rootDir, async (err, projectFiles, files = []) => {
    if (err) {
      return logError(err, LOG.PUSH_FAILURE);
    }
    if (!force){
      const localManifest = await readManifest();
      const remoteManifest = await readRemoteManifest();
      if( !deepEqual(localManifest,remoteManifest) ){
        const answers = await prompt([
          {
            name: 'overwrite',
            type: 'confirm',
            message: 'Manifest file has been updated. Do you want to push and overwrite?',
            default: false,
          },
        ]) as {overwrite:boolean};
        if( !answers.overwrite ){
          console.log('Stoping push...');
          return;
        }
      }
    }
    const [nonIgnoredFilePaths] = projectFiles || [[]];
    const filesForAPI: any = files;
    script.projects.updateContent(
      {
        scriptId,
        requestBody: {
          scriptId,
          files: filesForAPI,
        },
      },
      {},
      (error: any) => {
        spinner.stop(true);
        // In the following code, we favor console.error()
        // over logError() because logError() exits, whereas
        // we want to log multiple lines of messages, and
        // eventually exit after logging everything.
        if (error) {
          console.error(LOG.PUSH_FAILURE);
          error.errors.map((err: any) => {
            console.error(err.message);
          });
          console.error(LOG.FILES_TO_PUSH);
          nonIgnoredFilePaths.map((filePath: string) => {
            console.error(`└─ ${filePath}`);
          });
          process.exit(1);
        } else {
          nonIgnoredFilePaths.map((filePath: string) => {
            console.log(`└─ ${filePath}`);
          });
          console.log(LOG.PUSH_SUCCESS(nonIgnoredFilePaths.length));
        }
      },
    );
  });
}
