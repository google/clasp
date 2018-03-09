#!/usr/bin/env node
/**
 * @license
 * Copyright Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The Apps Script CLI
 */
import * as anymatch from "anymatch";
import 'connect';
import * as del from 'del';
const dotf = require('dotf');
const findParentDir = require('find-parent-dir');
import * as fs from 'fs';
const google = require('googleapis');
import * as http from 'http';
const isOnline = require('is-online');
import * as mkdirp from 'mkdirp';
const OAuth2 = google.auth.OAuth2;
const open = require('open');
import * as os from 'os';
const path = require('path');
import * as pluralize from 'pluralize';
const commander = require('commander');
const read = require('read-file');
const readMultipleFiles = require('read-multiple-files');
import * as recursive from 'recursive-readdir';
import { Spinner } from 'cli-spinner';
const splitLines = require('split-lines');
import * as url from 'url';
const readline = require('readline');
import { Server } from "http";

// Names / Paths
const PROJECT_NAME = 'clasp';
const PROJECT_MANIFEST_BASENAME = 'appsscript';
const PROJECT_MANIFEST_FULLNAME = `${PROJECT_MANIFEST_BASENAME}.json`;

// Dotfile names
const DOT = {
  IGNORE: { // Ignores files on `push`
    DIR: '~',
    NAME: `${PROJECT_NAME}ignore`,
    PATH: `.${PROJECT_NAME}ignore`,
  },
  PROJECT: { // Saves project information, local to project directory
    DIR: path.join('.', '/'), // Relative to where the command is run. See DOTFILE.PROJECT()
    NAME: `${PROJECT_NAME}.json`,
    PATH: `.${PROJECT_NAME}.json`,
  },
  RC: { // Saves global information, in the $HOME directory
    DIR: '~',
    NAME: `${PROJECT_NAME}rc.json`,
    PATH: path.join('~', `.${PROJECT_NAME}rc.json`),
    ABSOLUTE_PATH: path.join(os.homedir(), `.${PROJECT_NAME}rc.json`)
  },
};

// Clasp settings file (Saved in ~/.clasprc.json)
interface ClaspSettings {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: string;
}
// Project settings file (Saved in .clasp.json)
interface ProjectSettings {
  scriptId: string;
  rootDir: string;
}

// An Apps Script API File
interface AppsScriptFile {
  name: string;
  type: string;
  source: string;
}

interface LoginOptions {
  localhost: boolean;
}

// Dotfile files
const DOTFILE = {
  /**
   * Reads DOT.IGNORE.PATH to get a glob pattern of ignored paths.
   * @return {Promise<string[]>} A list of file glob patterns
   */
  IGNORE: () => {
    const projectDirectory: string = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
    const path = `${projectDirectory}/${DOT.IGNORE.PATH}`;
    return new Promise<string[]>((res, rej) => {
      if (fs.existsSync(path)) {
        const buffer = read.sync(DOT.IGNORE.PATH, 'utf8');
        res(splitLines(buffer).filter((name: string) => name));
      } else {
        res([]);
      }
    });
  },
  /**
   * Gets the closest DOT.PROJECT.NAME in the parent directory of the directory
   * that the command was run in.
   * @return {dotf} A dotf with that dotfile. Null if there is no file
   */
  PROJECT: () => {
    const projectDirectory: string = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
    return dotf(projectDirectory, DOT.PROJECT.NAME);
  },
  // See `login`: Stores { accessToken, refreshToken }
  RC: dotf(DOT.RC.DIR, DOT.RC.NAME),
};

// API settings
// @see https://developers.google.com/oauthplayground/
const REDIRECT_URI_OOB = 'urn:ietf:wg:oauth:2.0:oob';
const oauth2Client = new OAuth2(
  '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com', // CLIENT_ID
  'v6V3fKV_zWU7iw1DrpO1rknX', // CLIENT_SECRET
  'http://localhost'
);
const script = google.script({
  version: 'v1',
  auth: oauth2Client
});

// Log messages (some logs take required params)
const LOG = {
  AUTH_CODE: 'Enter the code from that page here: ',
  AUTH_PAGE_SUCCESSFUL: `Logged in! You may close this page.`, // HTML Redirect Page
  AUTH_SUCCESSFUL: `Saved the credentials to ${DOT.RC.PATH}. You may close the page.`,
  AUTHORIZE: (authUrl: string) => `🔑  Authorize ${PROJECT_NAME} by visiting this url:\n${authUrl}\n`,
  CLONE_SUCCESS: (fileNum: number) => `Cloned ${fileNum} ${pluralize('files', fileNum)}.`,
  CLONING: 'Cloning files...',
  CREATE_PROJECT_FINISH: (scriptId: string) => `Created new script: ${getScriptURL(scriptId)}`,
  CREATE_PROJECT_START: (title: string) => `Creating new script: ${title}...`,
  DEPLOYMENT_CREATE: 'Creating deployment...',
  DEPLOYMENT_DNE: 'No deployed versions of script.',
  DEPLOYMENT_LIST: (scriptId: string) => `Listing deployments for ${scriptId}...`,
  DEPLOYMENT_START: (scriptId: string) => `Deploying project ${scriptId}...`,
  FILES_TO_PUSH: 'Files to push were:',
  OPEN_PROJECT: (scriptId: string) => `Opening script: ${scriptId}`,
  PULLING: 'Pulling files...',
  PUSH_SUCCESS: (numFiles: number) => `Pushed ${numFiles} ${pluralize('files', numFiles)}.`,
  PUSH_FAILURE: 'Push failed. Errors:',
  PUSHING: 'Pushing files...',
  REDEPLOY_END: 'Updated deployment.',
  REDEPLOY_START: 'Updating deployment...',
  RENAME_FILE: (oldName: string, newName: string) => `Renamed file: ${oldName} -> ${newName}`,
  UNDEPLOYMENT_FINISH: (deploymentId: string) => `Undeployed ${deploymentId}.`,
  UNDEPLOYMENT_START: (deploymentId: string) => `Undeploy ${deploymentId}...`,
  UNTITLED_SCRIPT_TITLE: 'Untitled Script',
  VERSION_CREATE: 'Creating a new version...',
  VERSION_CREATED: (versionNumber: string) => `Created version ${versionNumber}.`,
  VERSION_DESCRIPTION: ({ versionNumber, description }: any) => `${versionNumber} - ${description || '(no description)'}`,
  VERSION_NUM: (numVersions: number) => `~ ${numVersions} ${pluralize('Version', numVersions)} ~`,
};

// Error messages (some errors take required params)
const ERROR = {
  ACCESS_TOKEN: `Error retrieving access token: `,
  COMMAND_DNE: (command: string) => `🤔  Unknown command "${command}"\n
Forgot ${PROJECT_NAME} commands? Get help:\n  ${PROJECT_NAME} --help`,
  CONFLICTING_FILE_EXTENSION: (name: string) => `File names: ${name}.js/${name}.gs conflict. Only keep one.`,
  CREATE: 'Error creating script.',
  DEPLOYMENT_COUNT: `Unable to deploy; Only one deployment can be created at a time`,
  FOLDER_EXISTS: `Project file (${DOT.PROJECT.PATH}) already exists.`,
  FS_DIR_WRITE: 'Could not create directory.',
  FS_FILE_WRITE: 'Could not write file.',
  LOGGED_IN: `You seem to already be logged in. Did you mean to 'logout'?`,
  LOGGED_OUT: `Please login. (${PROJECT_NAME} login)`,
  OFFLINE: 'Error: Looks like you are offline.',
  ONE_DEPLOYMENT_CREATE: 'Currently just one deployment can be created at a time.',
  READ_ONLY_DELETE: 'Unable to delete read-only deployment.',
  PERMISSION_DENIED: `Error: Permission denied. Enable the Apps Script API:
https://script.google.com/home/usersettings`,
  SCRIPT_ID: '\n> Did you provide the correct scriptId?\n',
  SCRIPT_ID_DNE: `No ${DOT.PROJECT.PATH} settings found. \`create\` or \`clone\` a project first.`,
  SCRIPT_ID_INCORRECT: (scriptId: string) => `The scriptId "${scriptId}" looks incorrect.
Did you provide the correct scriptId?`,
  UNAUTHENTICATED: 'Error: Unauthenticated request: Please try again.',
};

// Utils
const spinner = new Spinner();

/**
 * Logs errors to the user such as unauthenticated or permission denied
 * @param  {object} err         The object from the request's error
 * @param  {string} description The description of the error
 */
const logError = (err: any, description = '') => {
  // Errors are weird. The API returns interesting error structures.
  // TODO(timmerman) This will need to be standardized. Waiting for the API to
  // change error model. Don't review this method now.
  if (err && typeof err.error === 'string') {
    console.error(JSON.parse(err.error).error);
  } else if (err && err.statusCode === 401 || err && err.error && err.error.error && err.error.error.code === 401) {
    console.error(ERROR.UNAUTHENTICATED);
  } else if (err && (err.error && err.error.code === 403 || err.code === 403)) {
    console.error(ERROR.PERMISSION_DENIED);
  } else {
    if (err && err.error) {
      console.error(`~~ API ERROR (${err.statusCode || err.error.code})`);
      console.error(err.error);
    }
    if (description) console.error(description);
  }
};

/**
 * Gets the script URL from a script ID.
 *
 * It is too expensive to get the script URL from the Drive API. (Async/not offline)
 * @param  {string} scriptId The script ID
 * @return {string}          The URL of the script in the online script editor.
 */
const getScriptURL = (scriptId: string) => `https://script.google.com/d/${scriptId}/edit`;

/**
 * Gets the project settings from the project dotfile. Logs errors.
 * Should be used instead of `DOTFILE.PROJECT().read()`
 * @return {Promise} A promise to get the project script ID.
 */
function getProjectSettings(): Promise<ProjectSettings> {
  const promise = new Promise<ProjectSettings>((resolve, reject) => {
    const fail = () => {
      logError(null, ERROR.SCRIPT_ID_DNE);
      reject();
    };
    const dotfile = DOTFILE.PROJECT();
    if (dotfile) {
      // Found a dotfile, but does it have the settings, or is it corrupted?
      dotfile.read().then((settings: ProjectSettings) => {
        // Settings must have the script ID. Otherwise we err.
        if (settings.scriptId) {
          resolve(settings);
        } else {
          // TODO: Better error message
          fail(); // Script ID DNE
        }
      }).catch((err: object) => {
        fail(); // Failed to read dotfile
      });
    } else {
      fail(); // Never found a dotfile
    }
  });
  promise.catch(err => {
    logError(err);
    spinner.stop(true);
  });
  return promise;
}

/**
 * Loads the Apps Script API credentials for the CLI.
 * Required before every API call.
 * @param {Function} cb The callback
 */
function getAPICredentials(cb: (rc: ClaspSettings | void) => void) {
  DOTFILE.RC.read().then((rc: ClaspSettings) => {
    oauth2Client.credentials = rc;
    cb(rc);
  }).catch((err: object) => {
    logError(null, ERROR.LOGGED_OUT);
  });
}

/**
 * Requests authorization to manage Apps Script projects.
 * @param {boolean} useLocalhost True if a local HTTP server should be run
 *     to handle the auth response. False if manual entry used.
 */
function authorize(useLocalhost: boolean) {
  const codes = oauth2Client.generateCodeVerifier();
  // See https://developers.google.com/identity/protocols/OAuth2InstalledApp#step1-code-verifier
  const options = {
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/script.deployments',
      'https://www.googleapis.com/auth/script.projects',
    ],
    // code_challenge_method: 'S256',
    // code_challenge: codes.codeChallenge,
  };
  const authCode: Promise<string> = useLocalhost ?
    authorizeWithLocalhost(options) :
    authorizeWithoutLocalhost(options);

  authCode.then((code: string) => {
    return new Promise((res: Function, rej: Function) => {
      oauth2Client.getToken(code, (err: string, token: string) => {
        if (err) return rej(err);
        return res(token);
      });
    });
  })
    .then((token: object) => DOTFILE.RC.write(token))
    .then(() => console.log(LOG.AUTH_SUCCESSFUL))
    .catch((err: string) => console.error(ERROR.ACCESS_TOKEN + err));
}

/**
 * Requests authorization to manage Apps Scrpit projects. Spins up
 * a temporary HTTP server to handle the auth redirect.
 *
 * @param {Object} opts OAuth2 options TODO formalize options
 * @return {Promise} Promise resolving with the authorization code
 */
function authorizeWithLocalhost(opts: object): Promise<string> {
  return new Promise((res: Function, rej: Function) => {
    const server = http.createServer((req: http.ServerRequest, resp: http.ServerResponse) => {
      const urlParts = url.parse(req.url || '', true);
      const code = urlParts.query.code;
      if (urlParts.query.code) {
        res(urlParts.query.code);
      } else {
        rej(urlParts.query.error);
      }
      resp.end(LOG.AUTH_PAGE_SUCCESSFUL);
      setTimeout(() => { // TODO Remove hack to shutdown server.
        process.exit();
      }, 1000);
    });

    server.listen(0, () => {
      oauth2Client.redirectUri = `http://localhost:${server.address().port}`;
      const authUrl = oauth2Client.generateAuthUrl(opts);
      console.log(LOG.AUTHORIZE(authUrl));
      open(authUrl);
    });
  });
}

/**
 * Requests authorization to manage Apps Scrpit projects. Requires the
 * user to manually copy/paste the authorization code. No HTTP server is
 * used.
 *
 * @param {Object} opts OAuth2 options
 * @return {Promise} Promise resolving with the authorization code
 */

function authorizeWithoutLocalhost(opts: any): Promise<string> {
  oauth2Client.redirectUri = REDIRECT_URI_OOB;
  const authUrl = oauth2Client.generateAuthUrl(opts);
  console.log(LOG.AUTHORIZE(authUrl));

  return new Promise((res, rej) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(LOG.AUTH_CODE, (code: string) => {
      if (code && code.length) {
        res(code);
      } else {
        rej("No authorization code entered.");
      }
      rl.close();
    });
  });
}

/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/File#FileType
 */
function getFileType(type: string): string {
  return (type === 'SERVER_JS') ? 'js' : type.toLowerCase();
}

/**
 * Gets the API FileType. Assumes the path is valid.
 * @param  {string} path The file path
 * @return {string}      The API's FileType enum (uppercase), null if not valid.
 */
function getAPIFileType(path: string): string {
  const extension: string = path.substr(path.lastIndexOf('.') + 1).toUpperCase();
  return (extension === 'GS' || extension === 'JS') ? 'SERVER_JS' : extension.toUpperCase();
}

/**
 * Checks if the network is available. Gracefully exits if not.
 */
async function checkIfOnline() {
  if (!(await isOnline())) {
    logError(null, ERROR.OFFLINE);
    process.exit(1);
  }
}

/**
 * Saves the script ID in the project dotfile.
 * @param  {string} scriptId The script ID
 */
function saveProjectId(scriptId: string): void {
  DOTFILE.PROJECT().write({ scriptId }); // Save the script id
}

/**
 * Checks if the current directory appears to be a valid project.
 * @return {boolean} True if valid project, false otherwise
 */
function manifestExists(): boolean {
  return fs.existsSync(PROJECT_MANIFEST_FULLNAME);
}

// CLI

/**
 * Set global CLI configurations
 */
commander
  .usage(`${PROJECT_NAME} <command> [options]`)
  .description(`${PROJECT_NAME} - The Apps Script CLI`);

/**
 * Logs the user in. Saves the client credentials to an rc file.
 */
export function login(useLocalhost: boolean) {
  // Try to read the RC file.
  DOTFILE.RC.read().then((rc: ClaspSettings) => {
    console.warn(ERROR.LOGGED_IN);
  }).catch(async (err: string) => {
    await checkIfOnline();
    authorize(useLocalhost);
  });
}

commander
  .command('login')
  .description('Log in to script.google.com')
  .option('--no-localhost', 'Do not run a local server, manually enter code instead')
  .action((cmd: LoginOptions) => login(cmd.localhost));

/**
 * Logs out the user by deleteing client credentials.
 */
export function logout() {
  del(DOT.RC.ABSOLUTE_PATH, { force: true }); // del doesn't work with a relative path (~)
}

commander
  .command('logout')
  .description('Log out')
  .action(logout);

/**
 * Creates a new script project.
 * @param {string} [scriptTitle] An optional project title.
 * @param {string} [scriptParentId] An optional project parent Id. The Drive ID of a parent file
 *   that the created script project is bound to. This is usually the ID of a
 *   Google Doc, Google Sheet, Google Form, or Google Slides file. If not set, a
 *   standalone script project is created.
 * @example `create "My Script" "1D_Gxyv*****************************NXO7o"`
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/projects/create#body.request_body.FIELDS.parent_id
 */
export async function create(title: string = LOG.UNTITLED_SCRIPT_TITLE, parentId: string) {
  if (fs.existsSync(DOT.PROJECT.PATH)) {
    logError(null, ERROR.FOLDER_EXISTS);
  } else {
    getAPICredentials(async () => {
      await checkIfOnline();
      spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title));
      spinner.start();
      script.projects.create({ title, parentId }, {}, (error: object, { data }: any) => {
        const scriptId = data.scriptId;
        spinner.stop(true);
        if (error) {
          logError(error, ERROR.CREATE);
        } else {
          console.log(LOG.CREATE_PROJECT_FINISH(scriptId));
          saveProjectId(scriptId);
          if (!manifestExists()) {
            fetchProject(scriptId); // fetches appsscript.json, o.w. `push` breaks
          }
        }
      });
    });
  }
}

commander
  .command('create [scriptTitle] [scriptParentId]')
  .description('Create a script')
  .action(create);

/**
 * Fetches the files for a project from the server and writes files locally to
 * `pwd` with dots converted to subdirectories.
 * @param {string} scriptId The project script id
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 * @param {number?} versionNumber The version of files to fetch.
 */
function fetchProject(scriptId: string, rootDir = '', versionNumber?: number) {
  spinner.start();
  getAPICredentials(async () => {
    await checkIfOnline();
    script.projects.getContent({
      scriptId,
      versionNumber,
    }, {}, (error: any, { data }: any) => {
      spinner.stop(true);
      if (error) {
        if (error.statusCode === 404) return logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
        return logError(error, ERROR.SCRIPT_ID);
      } else {
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
  });
}

/**
 * Fetches a project and saves the script id locally.
 */
export async function clone(scriptId: string) {
  await checkIfOnline();
  spinner.setSpinnerTitle(LOG.CLONING);
  saveProjectId(scriptId);
  fetchProject(scriptId);
}

commander
  .command('clone <scriptId> [versionNumber]')
  .description('Clone a project')
  .action(clone);

/**
 * Fetches a project from either a provided or saved script id.
 */
export async function pull() {
 await checkIfOnline();
 getProjectSettings().then(({ scriptId, rootDir }: ProjectSettings) => {
   if (scriptId) {
     spinner.setSpinnerTitle(LOG.PULLING);
     fetchProject(scriptId, rootDir);
   }
 });
}

commander
  .command('pull')
  .description('Fetch a remote project')
  .action(pull);

/**
 * Force writes all local files to the script management server.
 * Ignores files:
 * - That start with a .
 * - That don't have an accepted file extension
 * - That are ignored (filename matches a glob pattern in the ignore file)
 */
export async function push() {
  spinner.setSpinnerTitle(LOG.PUSHING);
  spinner.start();
  getAPICredentials(async () => {
    await checkIfOnline();
    getProjectSettings().then(({ scriptId, rootDir }: ProjectSettings) => {
      if (!scriptId) return;
      // Read all filenames as a flattened tree
      recursive(rootDir || path.join('.', '/'), (err, filePaths) => {
        if (err) return logError(err);
        // Filter files that aren't allowed.
        filePaths = filePaths.filter((name) => !name.startsWith('.'));
        DOTFILE.IGNORE().then((ignorePatterns: string[]) => {
          filePaths = filePaths.sort(); // Sort files alphanumerically
          let abortPush = false;

          // Match the files with ignored glob pattern
          readMultipleFiles(filePaths, 'utf8', (err: string, contents: string[]) => {
            if (err) return console.error(err);
            const nonIgnoredFilePaths: string[] = [];

            // Check if there are any .gs files
            // We will prompt the user to rename files
            let canRenameToJS = false;
            filePaths.map((name, i) => {
              if (path.extname(name) === '.gs') {
                canRenameToJS = true;
              }
            });

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
              } else if (path.extname(name) === '.gs') {
                // rename file to js
                console.log(LOG.RENAME_FILE(fileNameWithoutExt + '.gs', fileNameWithoutExt + '.js'));
                fs.renameSync(fileNameWithoutExt + '.gs', fileNameWithoutExt + '.js');
              }
            });
            if (abortPush) return spinner.stop(true);

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
                  nameWithoutExt.length
                );
              }
              if (getAPIFileType(name) && !anymatch(ignorePatterns, name)) {
                nonIgnoredFilePaths.push(name);
                const file: AppsScriptFile = {
                  name: formattedName, // the file base name
                  type: getAPIFileType(name), // the file extension
                  source: contents[i] //the file contents
                };
                return file;
              } else {
                return; // Skip ignored files
              }
            }).filter(Boolean); // remove null values

            script.projects.updateContent({
              scriptId,
              resource: { files }
            }, {}, (error: any, res: Function) => {
              spinner.stop(true);
              if (error) {
                console.error(LOG.PUSH_FAILURE);
                error.errors.map((err: any) => {
                  console.error(err.message);
                });
                console.error(LOG.FILES_TO_PUSH);
                nonIgnoredFilePaths.map((filePath) => {
                  console.error(`└─ ${filePath}`);
                });
              } else {
                nonIgnoredFilePaths.map((filePath) => {
                  console.log(`└─ ${filePath}`);
                });
                console.log(LOG.PUSH_SUCCESS(nonIgnoredFilePaths.length));
              }
            });
          });
        });
      });
    });
  });
}

commander
  .command('push')
  .description('Update the remote project')
  .action(push);

/**
 * Opens the script editor in the user's browser.
 */
export function openScriptProject(scriptId: string) {
 getProjectSettings().then(async ({ scriptId }: ProjectSettings) => {
   if (scriptId) {
     console.log(LOG.OPEN_PROJECT(scriptId));
     if (scriptId.length < 30) {
       logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
     } else {
       await checkIfOnline();
       open(getScriptURL(scriptId));
     }
   }
 });
}

commander
  .command('open')
  .description('Open a script')
  .action(openScriptProject);

export function listDeployments() {
  getAPICredentials(async () => {
    await checkIfOnline();
    getProjectSettings().then(({ scriptId }: ProjectSettings) => {
      if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId));
      spinner.start();

      script.projects.deployments.list({
        scriptId
      }, {}, (error: any, { data }: any) => {
        spinner.stop(true);
        if (error) {
          logError(error);
        } else {
          const deployments = data.deployments;
          const numDeployments = deployments.length;
          const deploymentWord = pluralize('Deployment', numDeployments);
          console.log(`${numDeployments} ${deploymentWord}.`);
          deployments.map(({ deploymentId, deploymentConfig }: any) => {
            const versionString = !!deploymentConfig.versionNumber ?
              `@${deploymentConfig.versionNumber}` : '@HEAD';
            const description = deploymentConfig.description ?
              '- ' + deploymentConfig.description : '';
            console.log(`- ${deploymentId} ${versionString} ${description}`);
          });
        }
      });
    });
  });
}

/**
 * List deployments of a script
 */
commander
  .command('deployments')
  .description('List deployment ids of a script')
  .action(listDeployments);

/**
 * Creates a version and deploys a script.
 * The response gives the version of the deployment.
 */
export function deploy(version: string, description: string) {
  description = description || '';
  getAPICredentials(async () => {
    await checkIfOnline();
    getProjectSettings().then(({ scriptId }: ProjectSettings) => {
      if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId));
      spinner.start();

      function createDeployment(versionNumber: string) {
        spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
        script.projects.deployments.create({
          scriptId,
          resource: {
            versionNumber,
            manifestFileName: PROJECT_MANIFEST_BASENAME,
            description,
          }
        }, {}, (err: any, { data }: any) => {
          spinner.stop(true);
          if (err) {
            console.error(ERROR.DEPLOYMENT_COUNT);
          } else {
            console.log(`- ${data.deploymentId} @${versionNumber}.`);
          }
        });
      }

      // If the version is specified, update that deployment
      const versionRequestBody = {
        description
      };
      if (version) {
        createDeployment(version);
      } else { // if no version, create a new version and deploy that
        script.projects.versions.create({
          scriptId,
          resource: versionRequestBody
        }, {}, (err: any, { data }: any) => {
          spinner.stop(true);
          if (err) {
            logError(null, ERROR.ONE_DEPLOYMENT_CREATE);
          } else {
            console.log(LOG.VERSION_CREATED(data.versionNumber));
            createDeployment(data.versionNumber);
          }
        });
      }
    });
  });
}

commander
  .command('deploy [version] [description]')
  .description('Deploy a project')
  .action(deploy);

/**
 * Undeploys a deployment of a script.
 * @example "undeploy 123"
 */
export function undeploy(deploymentId: string) {
   getAPICredentials(async () => {
     await checkIfOnline();
     getProjectSettings().then(({ scriptId }: ProjectSettings) => {
       if (!scriptId) return;
       spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId));
       spinner.start();

       script.projects.deployments.delete({
         scriptId,
         deploymentId,
       }, {}, (err: any, res: any) => {  // TODO remove any
         spinner.stop(true);
         if (err) {
           logError(null, ERROR.READ_ONLY_DELETE);
         } else {
           console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
         }
       });
     });
   });
 }

commander
  .command('undeploy <deploymentId>')
  .description('Undeploy a deployment of a project')
  .action(undeploy);

/**
 * Updates deployments of a script
 */
export function redeploy(deploymentId: string, version: string, description: string) {
  getAPICredentials(async () => {
   await checkIfOnline();
   getProjectSettings().then(({ scriptId }: ProjectSettings) => {
     script.projects.deployments.update({
       scriptId,
       deploymentId,
       resource: {
         deploymentConfig: {
           versionNumber: version,
           manifestFileName: PROJECT_MANIFEST_BASENAME,
           description
         }
       }
     }, {}, (error: any, res: any) => { // TODO remove any
       spinner.stop(true);
       if (error) {
         logError(null, error); // TODO prettier error
       } else {
         console.log(LOG.REDEPLOY_END);
       }
     });
   });
  });
 }

commander
  .command('redeploy <deploymentId> <version> <description>')
  .description(`Update a deployment`)
  .action(redeploy);

/**
 * List versions of a script
 */
export function listVersions() {
  spinner.setSpinnerTitle('Grabbing versions...');
  spinner.start();
  getAPICredentials(async () => {
   await checkIfOnline();
   getProjectSettings().then(({ scriptId }: ProjectSettings) => {
     script.projects.versions.list({
       scriptId,
     }, {}, (error: any, { data }: any) => {
       spinner.stop(true);
       if (error) {
         logError(error);
       } else {
         if (data && data.versions && data.versions.length) {
           const numVersions = data.versions.length;
           console.log(LOG.VERSION_NUM(numVersions));
           data.versions.map((version: string) => {
             console.log(LOG.VERSION_DESCRIPTION(version));
           });
         } else {
           console.error(LOG.DEPLOYMENT_DNE);
         }
       }
     });
   });
  });
}

commander
  .command('versions')
  .description('List versions of a script')
  .action(listVersions);

/**
 * Creates an immutable version of the script
 */
export function createVersion(description: string) {
  spinner.setSpinnerTitle(LOG.VERSION_CREATE);
  spinner.start();
  getAPICredentials(async () => {
   await checkIfOnline();
   getProjectSettings().then(({ scriptId }: ProjectSettings) => {
     script.projects.versions.create({
       scriptId,
       description,
     }, {}, (error: any, { data }: any) => {
       spinner.stop(true);
       if (error) {
         logError(error);
       } else {
         console.log(LOG.VERSION_CREATED(data.versionNumber));
       }
     });
   }).catch((err: any) => {
     spinner.stop(true);
     logError(err);
   });
  });
}

commander
  .command('version [description]')
  .description('Creates an immutable version of the script')
  .action(createVersion);

/**
 * All other commands are given a help message.
 */
commander
  .command('', { isDefault: true })
  .action((command: string) => {
    console.error(ERROR.COMMAND_DNE(command));
  });

// defaults to help if commands are not provided
if (!process.argv.slice(2).length) {
  commander.outputHelp();
}

// User input is provided from the process' arguments
commander.parse(process.argv);
