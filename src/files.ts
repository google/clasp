import * as fs from 'fs';
import * as anymatch from 'anymatch';
import * as mkdirp from 'mkdirp';
import * as recursive from 'recursive-readdir';
import { loadAPICredentials, script } from './auth';
import {
  DOT,
  DOTFILE,
  ERROR,
  LOG,
  checkIfOnline,
  getAPIFileType,
  getProjectSettings,
  logError,
  spinner,
} from './utils';
const path = require('path');
const readMultipleFiles = require('read-multiple-files');

// An Apps Script API File
interface AppsScriptFile {
  name: string;
  type: string;
  source: string;
}

// Used to receive files tracked by current project
interface FilesCallback {
  (
    error: Error | boolean,
    result: string[][] | null,
    files: Array<AppsScriptFile | undefined> | null,
  ) : void;
}

/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/File#FileType
 */
export function getFileType(type: string): string {
  return (type === 'SERVER_JS') ? 'js' : type.toLowerCase();
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
 * error: Error if there's an error, otherwise null
 * result: string[][], List of two lists of strings, ie. [nonIgnoredFilePaths,ignoredFilePaths]
 * files?: Array<AppsScriptFile|undefined> Array of AppsScriptFile objects used by clasp push
 */
export function getProjectFiles(rootDir: string, callback: FilesCallback): void {
  // Read all filenames as a flattened tree
  recursive(rootDir || path.join('.', '/'), (err, filePaths) => {
    if (err) return callback(err, null, null);
    // Filter files that aren't allowed.
    filePaths = filePaths.filter((name) => !name.startsWith('.'));
    DOTFILE.IGNORE().then((ignorePatterns: string[]) => {
      filePaths = filePaths.sort(); // Sort files alphanumerically
      let abortPush = false;
      const nonIgnoredFilePaths: string[] = [];
      const ignoredFilePaths: string[] = [];
      // Match the files with ignored glob pattern
      readMultipleFiles(filePaths, 'utf8', (err: string, contents: string[]) => {
        if (err) return callback(new Error(err), null, null);
        // Check if there are any .gs files
        // We will prompt the user to rename files
        //
        // TODO: implement renaming files from .gs to .js
        // let canRenameToJS = false;
        // filePaths.map((name, i) => {
        //   if (path.extname(name) === '.gs') {
        //     canRenameToJS = true;
        //   }
        // });
        // Check if there are files that will conflict if renamed .gs to .js
        filePaths.map((name: string) => {
          const fileNameWithoutExt = name.slice(0, -path.extname(name).length);
          if (filePaths.indexOf(fileNameWithoutExt + '.js') !== -1 &&
            filePaths.indexOf(fileNameWithoutExt + '.gs') !== -1) {
            // Can't rename, conflicting files
            abortPush = true;
            if (path.extname(name) === '.gs') { // only print error once (for .gs)
              logError(null, ERROR.CONFLICTING_FILE_EXTENSION(fileNameWithoutExt));
            }
          }
        });

        if(abortPush) return callback(new Error(), null, null);

        const files = filePaths.map((name, i) => {
          let nameWithoutExt = name.slice(0, -path.extname(name).length);
          // Replace OS specific path separator to common '/' char
          nameWithoutExt = nameWithoutExt.replace(/\\/g, '/');

          // Formats rootDir/appsscript.json to appsscript.json.
          // Preserves subdirectory names in rootDir
          // (rootDir/foo/Code.js becomes foo/Code.js)
          let formattedName = nameWithoutExt;
          if (rootDir) {
            formattedName = nameWithoutExt.slice(
              rootDir.length + 1,
              nameWithoutExt.length,
            );
          }
          if (getAPIFileType(name) && !anymatch(ignorePatterns, name)) {
            nonIgnoredFilePaths.push(name);
            const file: AppsScriptFile = {
              name: formattedName, // the file base name
              type: getAPIFileType(name), // the file extension
              source: contents[i], //the file contents
            };
            return file;
          } else {
            ignoredFilePaths.push(name);
            return; // Skip ignored files
          }
        }).filter(Boolean); // remove null values
        callback(false, [nonIgnoredFilePaths, ignoredFilePaths], files);
      });
    });
  });
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
  spinner.start();
  script.projects.getContent({
    scriptId,
    versionNumber,
  }, {}, (error: any, res: any) => {
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
        const filePath = `${file.name}.${getFileType(file.type)}`;
        const truePath = `${rootDir || '.'}/${filePath}`;
        mkdirp(path.dirname(truePath), (err) => {
          if (err) return logError(err, ERROR.FS_DIR_WRITE);
          if (!file.source) return; // disallow empty files
          fs.writeFile(truePath, file.source, (err) => {
            if (err) return logError(err, ERROR.FS_FILE_WRITE);
          });
          // Log only filename if pulling to root (Code.gs vs ./Code.gs)
          console.log(`└─ ${rootDir ? truePath : filePath}`);
        });
      });
    }
  });
}

/**
 * Pushes project files to script.google.com.
 */
export async function pushFiles() {
  const { scriptId, rootDir } = await getProjectSettings();
  if (!scriptId) return;
    getProjectFiles(rootDir, (err, projectFiles, files) => {
      if (err) {
        logError(err, LOG.PUSH_FAILURE);
        spinner.stop(true);
      } else if (projectFiles) {
        const [nonIgnoredFilePaths] = projectFiles;
        script.projects.updateContent({
          scriptId,
          resource: { files },
        }, {}, (error: any) => {
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
      });
    }
  });
}