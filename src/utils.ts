import * as fs from 'fs';
import * as os from 'os';
import { Spinner } from 'cli-spinner';
import * as pluralize from 'pluralize';
const path = require('path');
const findParentDir = require('find-parent-dir');
const splitLines = require('split-lines');
const dotf = require('dotf');
const read = require('read-file');
const isOnline = require('is-online');

// Names / Paths
export const PROJECT_NAME = 'clasp';
export const PROJECT_MANIFEST_BASENAME = 'appsscript';

// Dotfile names
export const DOT = {
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
    LOCAL_DIR: './',
    NAME: `${PROJECT_NAME}rc.json`,
    PATH: path.join('~', `.${PROJECT_NAME}rc.json`),
    ABSOLUTE_PATH: path.join(os.homedir(), `.${PROJECT_NAME}rc.json`),
    ABSOLUTE_LOCAL_PATH: path.join('.', `.${PROJECT_NAME}rc.json`),
  },
};

// Clasp settings file (Saved in ~/.clasprc.json)
export interface ClaspSettings {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
// Project settings file (Saved in .clasp.json)
export interface ProjectSettings {
  scriptId: string;
  rootDir: string;
  projectId: string;
}

export const DOTFILE = {
  /**
   * Reads DOT.IGNORE.PATH to get a glob pattern of ignored paths.
   * @return {Promise<string[]>} A list of file glob patterns
   */
  IGNORE: () => {
    const projectDirectory: string = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
    return new Promise<string[]>((res, rej) => {
      if (fs.existsSync(path.join(projectDirectory, DOT.IGNORE.PATH))) {
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
  RC_LOCAL: dotf(DOT.RC.LOCAL_DIR, DOT.RC.NAME),
};

// Error messages (some errors take required params)
export const ERROR = {
  ACCESS_TOKEN: `Error retrieving access token: `,
  BAD_CREDENTIALS_FILE: 'Incorrect credentials file format.',
  COMMAND_DNE: (command: string) => `🤔  Unknown command "${command}"\n
Forgot ${PROJECT_NAME} commands? Get help:\n  ${PROJECT_NAME} --help`,
  CONFLICTING_FILE_EXTENSION: (name: string) => `File names: ${name}.js/${name}.gs conflict. Only keep one.`,
  CREATE: 'Error creating script.',
  CREDENTIALS_DNE: 'Credentials file not found.',
  DEPLOYMENT_COUNT: `Unable to deploy; Scripts may only have up to 20 versioned deployments at a time.`,
  FOLDER_EXISTS: `Project file (${DOT.PROJECT.PATH}) already exists.`,
  FS_DIR_WRITE: 'Could not create directory.',
  FS_FILE_WRITE: 'Could not write file.',
  LOGGED_IN: `You seem to already be logged in. Did you mean to 'logout'?`,
  LOGGED_OUT: `\nCommand failed. Please login. (${PROJECT_NAME} login)`,
  LOGS_UNAVAILABLE: 'StackDriver logs are getting ready, try again soon.',
  OFFLINE: 'Error: Looks like you are offline.',
  ONE_DEPLOYMENT_CREATE: 'Currently just one deployment can be created at a time.',
  NO_FUNCTION_NAME: 'N/A',
  NO_GCLOUD_PROJECT: `\nPlease set your projectId in your .clasp.json file to your Google Cloud project ID. \n
  You can find your projectId by following the instructions in the README here: \n
  https://github.com/google/clasp#get-project-id`,
  NO_NESTED_PROJECTS: '\nNested clasp projects are not supported.',
  READ_ONLY_DELETE: 'Unable to delete read-only deployment.',
  PAYLOAD_UNKNOWN: 'Unknown StackDriver payload.',
  PERMISSION_DENIED: `Error: Permission denied. Enable the Apps Script API:
https://script.google.com/home/usersettings`,
  RATE_LIMIT: 'Rate limit exceeded. Check quota.',
  SCRIPT_ID: '\n> Did you provide the correct scriptId?\n',
  SCRIPT_ID_DNE: `\nNo ${DOT.PROJECT.PATH} settings found. \`create\` or \`clone\` a project first.`,
  SCRIPT_ID_INCORRECT: (scriptId: string) => `The scriptId "${scriptId}" looks incorrect.
Did you provide the correct scriptId?`,
  UNAUTHENTICATED: 'Error: Unauthenticated request: Please try again.',
};

// Log messages (some logs take required params)
export const LOG = {
  AUTH_CODE: 'Enter the code from that page here: ',
  AUTH_PAGE_SUCCESSFUL: `Logged in! You may close this page.`, // HTML Redirect Page
  AUTH_SUCCESSFUL: `Saved the credentials to ${DOT.RC.PATH}. You may close the page.`,
  AUTHORIZE: (authUrl: string) => `🔑  Authorize ${PROJECT_NAME} by visiting this url:\n${authUrl}\n`,
  CLONE_SUCCESS: (fileNum: number) => `Cloned ${fileNum} ${pluralize('files', fileNum)}.`,
  CLONING: 'Cloning files...',
  CREATE_PROJECT_FINISH: (scriptId: string) => `Created new script: ${getScriptURL(scriptId)}`,
  CREATE_PROJECT_START: (title: string) => `Creating new script: ${title}...`,
  CREDENTIALS_FOUND: 'Credentials found, using those to login...',
  DEFAULT_CREDENTIALS: 'No credentials given, continuing with default...',
  DEPLOYMENT_CREATE: 'Creating deployment...',
  DEPLOYMENT_DNE: 'No deployed versions of script.',
  DEPLOYMENT_LIST: (scriptId: string) => `Listing deployments...`,
  DEPLOYMENT_START: (scriptId: string) => `Deploying project...`,
  FILES_TO_PUSH: 'Files to push were:',
  FINDING_SCRIPTS: 'Finding your scripts...',
  FINDING_SCRIPTS_DNE: 'No script files found.',
  OPEN_PROJECT: (scriptId: string) => `Opening script: ${scriptId}`,
  PULLING: 'Pulling files...',
  STATUS_PUSH: 'The following files will be pushed by clasp push:',
  STATUS_IGNORE: 'Untracked files:',
  PUSH_SUCCESS: (numFiles: number) => `Pushed ${numFiles} ${pluralize('files', numFiles)}.`,
  PUSH_FAILURE: 'Push failed. Errors:',
  PUSH_WATCH: 'Watching for changed files...\n',
  PUSH_WATCH_UPDATED: (filename: string) => `- Updated: ${filename}`,
  PUSHING: 'Pushing files...',
  REDEPLOY_END: 'Updated deployment.',
  REDEPLOY_START: 'Updating deployment...',
  STACKDRIVER_SETUP: 'Setting up StackDriver Logging.',
  UNDEPLOYMENT_FINISH: (deploymentId: string) => `Undeployed ${deploymentId}.`,
  UNDEPLOYMENT_START: (deploymentId: string) => `Undeploy ${deploymentId}...`,
  UNTITLED_SCRIPT_TITLE: 'Untitled Script',
  VERSION_CREATE: 'Creating a new version...',
  VERSION_CREATED: (versionNumber: string) => `Created version ${versionNumber}.`,
  VERSION_DESCRIPTION: ({ versionNumber, description }: any) => `${versionNumber} - ` +
      (description || '(no description)'),
  VERSION_NUM: (numVersions: number) => `~ ${numVersions} ${pluralize('Version', numVersions)} ~`,
};

export const spinner = new Spinner();

/**
 * Logs errors to the user such as unauthenticated or permission denied
 * @param  {object} err         The object from the request's error
 * @param  {string} description The description of the error
 */
export const logError = (err: any, description = '') => {
  // Errors are weird. The API returns interesting error structures.
  // TODO(timmerman) This will need to be standardized. Waiting for the API to
  // change error model. Don't review this method now.
  if (err && typeof err.error === 'string') {
    logError(null, JSON.parse(err.error).error);
  } else if (err && err.statusCode === 401 || err && err.error &&
             err.error.error && err.error.error.code === 401) {
    logError(null, ERROR.UNAUTHENTICATED);
  } else if (err && (err.error && err.error.code === 403 || err.code === 403)) {
    logError(null, ERROR.PERMISSION_DENIED);
  } else if (err && err.code === 429) {
    logError(null, ERROR.RATE_LIMIT);
  } else {
    if (err && err.error) {
      console.error(`~~ API ERROR (${err.statusCode || err.error.code})`);
      console.error(err.error);
    }
    if (description) console.error(description);
    process.exit(1);
  }
};

/**
 * Gets the script URL from a script ID.
 *
 * It is too expensive to get the script URL from the Drive API. (Async/not offline)
 * @param  {string} scriptId The script ID
 * @return {string}          The URL of the script in the online script editor.
 */
export const getScriptURL = (scriptId: string) => `https://script.google.com/d/${scriptId}/edit`;

/**
 * Gets the project settings from the project dotfile. Logs errors.
 * Should be used instead of `DOTFILE.PROJECT().read()`
 * @param  {boolean} failSilently Don't err when dot file DNE.
 * @return {Promise} A promise to get the project script ID.
 */
export function getProjectSettings(failSilently?: boolean): Promise<ProjectSettings> {
  const promise = new Promise<ProjectSettings>((resolve, reject) => {
    const fail = (failSilently?: boolean) => {
      if (!failSilently) {
        logError(null, ERROR.SCRIPT_ID_DNE);
        reject();
      }
      resolve();
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
        fail(failSilently); // Failed to read dotfile
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
 * Gets the API FileType. Assumes the path is valid.
 * @param  {string} path The file path
 * @return {string}      The API's FileType enum (uppercase), null if not valid.
 */
export function getAPIFileType(path: string): string {
  const extension: string = path.substr(path.lastIndexOf('.') + 1).toUpperCase();
  return (extension === 'GS' || extension === 'JS') ? 'SERVER_JS' : extension.toUpperCase();
}

/**
 * Checks if the network is available. Gracefully exits if not.
 */
export async function checkIfOnline() {
  if (!(await isOnline())) {
    logError(null, ERROR.OFFLINE);
    process.exit(1);
  }
}

/**
 * Saves the script ID in the project dotfile.
 * @param  {string} scriptId The script ID
 */
export async function saveProjectId(scriptId: string): Promise<string> {
  return DOTFILE.PROJECT().write({ scriptId }); // Save the script id
}

/**
 * Checks if the current directory appears to be a valid project.
 * @return {boolean} True if valid project, false otherwise
 */
export function manifestExists(): boolean {
  return fs.existsSync(`${PROJECT_MANIFEST_BASENAME}.json`);
}