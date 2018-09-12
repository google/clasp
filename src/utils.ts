import * as fs from 'fs';
import * as os from 'os';
import { Spinner } from 'cli-spinner';
import * as pluralize from 'pluralize';
const ucfirst = require('ucfirst');
const path = require('path');
const findParentDir = require('find-parent-dir');
const splitLines = require('split-lines');
const dotf = require('dotf');
const read = require('read-file');
const isOnline = require('is-online');
const { prompt } = require('inquirer');
const chalk = require('chalk');

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

// Default OAuth client settings file (Saved in ~/.clasprc.json)
// google-auth-library { Credentials }
interface ClaspSettingsDefault {
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string | null;
}

// Local OAuth client settings file (Saved in ./.clasprc.json)
interface ClaspSettingsLocal {
  // google-auth-library { Credentials }
  token: {
    access_token?: string | null;
    refresh_token?: string | null;
    token_type?: string | null;
  };
  oauth2ClientSettings: {
    clientId: string;
    clientSecret: string;
  };
}

// TODO should be single iface { token: {}, oauth2ClientSettings: {} }
export type ClaspSettings = ClaspSettingsDefault | ClaspSettingsLocal;

/**
 * Type guard for {ClaspSettings} union
 * @param {ClaspSettings} settings
 * @return {boolean}
 */
export const isLocalCreds = (settings: ClaspSettings): settings is ClaspSettingsLocal =>
  (settings as ClaspSettingsLocal).oauth2ClientSettings !== undefined;

// Project settings file (Saved in .clasp.json)
export interface ProjectSettings {
  scriptId: string;
  rootDir?: string;
  projectId?: string;
  fileExtension?: string;
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
  // Stores {ClaspSettingsDefault}
  RC: dotf(DOT.RC.DIR, DOT.RC.NAME),
  // Stores {ClaspSettingsLocal}
  RC_LOCAL: dotf(DOT.RC.LOCAL_DIR, DOT.RC.NAME),
};

/**
 * Checks if local OAuth client settings rc file exisits.
 * @return {boolean}
 */
export const localOathSettingsExist = (): boolean =>
  fs.existsSync(DOT.RC.ABSOLUTE_LOCAL_PATH);

/**
 * Checks if default OAuth client settings rc file exisits.
 * @return {boolean}
 */
export const defaultOathSettingsExist = (): boolean =>
  fs.existsSync(DOT.RC.ABSOLUTE_PATH);

/**
 * Gets the OAuth client settings from rc file.
 * Should be used instead of `DOTFILE.RC?().read()`
 * TODO sanity checks & single ClaspSettings iface with backwards compatibility
 * @returns {Promise<ClaspSettings>} A promise to get the rc file as object.
 */
export function getOAuthSettings(): Promise<ClaspSettings> {
  return DOTFILE.RC_LOCAL.read()
    .then((rc: ClaspSettingsLocal) => rc)
    .catch((err: any) => {
      return DOTFILE.RC.read()
        .then((rc: ClaspSettingsDefault) => rc)
        .catch((err: any) => {
          logError(err, ERROR.NO_CREDENTIALS);
        });
    });
}

// Helpers to get Apps Script project URLs
export const URL = {
  CREDS: (projectId: string) =>
    `https://console.developers.google.com/apis/credentials?project=${projectId}`,
  LOGGING_API_PROJECT: (projectId: string) =>
    `https://console.cloud.google.com/apis/library/logging.googleapis.com?project=${projectId}`,
  LOGS: (projectId: string) =>
    `https://console.cloud.google.com/logs/viewer?project=${projectId}&resource=app_script_function`,
  SCRIPT_API_PROJECT: (projectId: string) =>
    `https://console.cloud.google.com/apis/library/script.googleapis.com/?project=${projectId}`,
  SCRIPT_API_USER: 'https://script.google.com/home/usersettings',
  // It is too expensive to get the script URL from the Drive API. (Async/not offline)
  SCRIPT: (scriptId: string) => `https://script.google.com/d/${scriptId}/edit`,
};

// Error messages (some errors take required params)
export const ERROR = {
  ACCESS_TOKEN: `Error retrieving access token: `,
  BAD_CREDENTIALS_FILE: 'Incorrect credentials file format.',
  BAD_REQUEST: (message: string) => `Error: ${message}
Your credentials may be invalid. Try logging in again.`,
  COMMAND_DNE: (command: string) => `🤔  Unknown command "${PROJECT_NAME} ${command}"\n
Forgot ${PROJECT_NAME} commands? Get help:\n  ${PROJECT_NAME} --help`,
  CONFLICTING_FILE_EXTENSION: (name: string) => `File names: ${name}.js/${name}.gs conflict. Only keep one.`,
  CREATE_WITH_PARENT: 'Did you provide the correct parentId?',
  CREATE: 'Error creating script.',
  DEPLOYMENT_COUNT: `Unable to deploy; Scripts may only have up to 20 versioned deployments at a time.`,
  EXECUTE_ENTITY_NOT_FOUND: `Script API executable not published/deployed.`,
  FOLDER_EXISTS: `Project file (${DOT.PROJECT.PATH}) already exists.`,
  FS_DIR_WRITE: 'Could not create directory.',
  FS_FILE_WRITE: 'Could not write file.',
  LOGGED_IN: `You seem to already be logged in. Did you mean to 'logout'?`,
  LOGGED_OUT: `\nCommand failed. Please login. (${PROJECT_NAME} login)`,
  LOGS_NODATA: 'StackDriver logs query returned no data.',
  LOGS_UNAVAILABLE: 'StackDriver logs are getting ready, try again soon.',
  NO_CREDENTIALS: 'Could not read API credentials. Are you logged in?',
  NO_FUNCTION_NAME: 'N/A',
  NO_GCLOUD_PROJECT: `No projectId found in your ${DOT.PROJECT.PATH} file.`,
  NO_LOCAL_CREDENTIALS: `Requires local crendetials:\n\n  ${PROJECT_NAME} login --creds <file.json>`,
  NO_MANIFEST: (filename: string) =>
    `Manifest: ${filename} invalid. \`create\` or \`clone\` a project first.`,
  NO_NESTED_PROJECTS: '\nNested clasp projects are not supported.',
  NO_WEBAPP: (deploymentId: string) => `Deployment "${deploymentId}" is not deployed as WebApp.`,
  OFFLINE: 'Error: Looks like you are offline.',
  ONE_DEPLOYMENT_CREATE: 'Currently just one deployment can be created at a time.',
  PAYLOAD_UNKNOWN: 'Unknown StackDriver payload.',
  PERMISSION_DENIED_LOCAL: `Error: Permission denied. Enable required APIs (eg. Script/Logging) for project.`,
  PERMISSION_DENIED: `Error: Permission denied. Enable the Apps Script API:\n${URL.SCRIPT_API_USER}`,
  RATE_LIMIT: 'Rate limit exceeded. Check quota.',
  READ_ONLY_DELETE: 'Unable to delete read-only deployment.',
  SCRIPT_ID_DNE: `No scriptId found in your ${DOT.PROJECT.PATH} file.`,
  SCRIPT_ID_INCORRECT: (scriptId: string) => `The scriptId "${scriptId}" looks incorrect.
Did you provide the correct scriptId?`,
  SCRIPT_ID: '\n> Did you provide the correct scriptId?\n',
  SETTINGS_DNE: `\nNo ${DOT.PROJECT.PATH} settings found. \`create\` or \`clone\` a project first.`,
  UNAUTHENTICATED_LOCAL: `Error: Local client credentials unauthenticated. Check scopes/authorization.`,
  UNAUTHENTICATED: 'Error: Unauthenticated request: Please try again.',
};

// Log messages (some logs take required params)
export const LOG = {
  AUTH_CODE: 'Enter the code from that page here: ',
  AUTH_PAGE_SUCCESSFUL: `Logged in! You may close this page.`, // HTML Redirect Page
  AUTH_SUCCESSFUL: `Authorization successful.`,
  AUTHORIZE: (authUrl: string) => `🔑  Authorize ${PROJECT_NAME} by visiting this url:\n${authUrl}\n`,
  CLONE_SUCCESS: (fileNum: number) => `Cloned ${fileNum} ${pluralize('files', fileNum)}.`,
  CLONING: 'Cloning files...',
  CREATE_PROJECT_FINISH: (scriptId: string) => `Created new script: ${URL.SCRIPT(scriptId)}`,
  CREATE_PROJECT_START: (title: string) => `Creating new script: ${title}...`,
  CREDENTIALS_FOUND: 'Credentials found, using those to login...',
  DEFAULT_CREDENTIALS: 'No credentials given, continuing with default...',
  DEPLOYMENT_CREATE: 'Creating deployment...',
  DEPLOYMENT_DNE: 'No deployed versions of script.',
  DEPLOYMENT_LIST: (scriptId: string) => `Listing deployments...`,
  DEPLOYMENT_START: (scriptId: string) => `Deploying project...`,
  FILES_TO_PUSH: 'Files to push were:',
  FINDING_SCRIPTS_DNE: 'No script files found.',
  FINDING_SCRIPTS: 'Finding your scripts...',
  GRAB_LOGS: 'Grabbing logs...',
  LOCAL_CREDS: `Using local credentials: ${DOT.RC.LOCAL_DIR}${DOT.RC.NAME} 🔐 `,
  OPEN_PROJECT: (scriptId: string) => `Opening script: ${scriptId}`,
  OPEN_WEBAPP: (deploymentId: string) => `Opening web application: ${deploymentId}`,
  PULLING: 'Pulling files...',
  PUSH_FAILURE: 'Push failed. Errors:',
  PUSH_SUCCESS: (numFiles: number) => `Pushed ${numFiles} ${pluralize('files', numFiles)}.`,
  PUSH_WATCH_UPDATED: (filename: string) => `- Updated: ${filename}`,
  PUSH_WATCH: 'Watching for changed files...\n',
  PUSHING: 'Pushing files...',
  REDEPLOY_END: 'Updated deployment.',
  REDEPLOY_START: 'Updating deployment...',
  SAVED_CREDS: `Default credentials saved to: ${DOT.RC.PATH} (${DOT.RC.ABSOLUTE_PATH}).`,
  SAVED_LOCAL_CREDS: `Local credentials saved to: ${DOT.RC.LOCAL_DIR}${DOT.RC.NAME}.`,
  STACKDRIVER_SETUP: 'Setting up StackDriver Logging.',
  STATUS_IGNORE: 'Ignored files:',
  STATUS_PUSH: 'Not ignored files:',
  UNDEPLOYMENT_FINISH: (deploymentId: string) => `Undeployed ${deploymentId}.`,
  UNDEPLOYMENT_START: (deploymentId: string) => `Undeploy ${deploymentId}...`,
  VERSION_CREATE: 'Creating a new version...',
  VERSION_CREATED: (versionNumber: string) => `Created version ${versionNumber}.`,
  VERSION_DESCRIPTION: ({ versionNumber, description }: any) => `${versionNumber} - ` +
      (description || '(no description)'),
  VERSION_NUM: (numVersions: number) => `~ ${numVersions} ${pluralize('Version', numVersions)} ~`,

  SETUP_LOCAL_OAUTH: (projectId: string) => `1. Enable the Script & Logging APIs for the project:
  a. Open this link: ${chalk.blue(URL.SCRIPT_API_PROJECT(projectId))}
      Click ${chalk.cyan('ENABLE')}.
  b. Open this link: ${chalk.blue(URL.LOGGING_API_PROJECT(projectId))}
      Click ${chalk.cyan('ENABLE')}.

2. Create a valid Client ID and client secret:
    Open this link: ${chalk.blue(URL.CREDS(projectId))}
    Click ${chalk.cyan('Create credentials')}, then select ${chalk.yellow('OAuth client ID')}.
    Select ${chalk.yellow('Other')}.
    Give the client a ${chalk.yellow('name')}.
    Click ${chalk.cyan('Create')}.
    Click ${chalk.cyan('Download JSON')} for the new client ID: ${chalk.yellow('name')} (right-hand side).

3. Authenticate clasp with your credentials json file:
    clasp login --creds <client_credentials.json>`,

};

export const spinner = new Spinner();

/**
 * Logs errors to the user such as unauthenticated or permission denied
 * @param  {object} err         The object from the request's error
 * @param  {string} description The description of the error
 */
export const logError = (err: any, description = '') => {
  spinner.stop(true);
  // Errors are weird. The API returns interesting error structures.
  // TODO(timmerman) This will need to be standardized. Waiting for the API to
  // change error model. Don't review this method now.
  if (err && typeof err.error === 'string') {
    logError(null, JSON.parse(err.error).error);
  } else if (err && err.statusCode === 401 || err && err.error &&
             err.error.error && err.error.error.code === 401) {
    // TODO check if local creds exist:
    //  localOathSettingsExist() ? ERROR.UNAUTHENTICATED : ERROR.UNAUTHENTICATED_LOCAL
    logError(null, ERROR.UNAUTHENTICATED);
  } else if (err && (err.error && err.error.code === 403 || err.code === 403)) {
    // TODO check if local creds exist:
    //  localOathSettingsExist() ? ERROR.PERMISSION_DENIED : ERROR.PERMISSION_DENIED_LOCAL
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
 * Gets the web application URL from a deployment.
 *
 * It is too expensive to get the web application URL from the Drive API. (Async/not offline)
 * @param  {any} deployment The deployment
 * @return {string}          The URL of the web application in the online script editor.
 */
export function getWebApplicationURL(deployment: any) {
  const entryPoints = deployment.entryPoints || [];
  const webEntryPoint = entryPoints.find((entryPoint: any) => entryPoint.entryPointType === 'WEB_APP');
  if (!webEntryPoint) {
    logError(null, ERROR.NO_WEBAPP(deployment.deploymentId));
  }
  return webEntryPoint.webApp.url;
}

/**
 * Gets default project name.
 * @return {string} default project name.
 */
export function getDefaultProjectName(): string {
  return ucfirst(path.basename(process.cwd()));
}

/**
 * Gets the project settings from the project dotfile. Logs errors.
 * Should be used instead of `DOTFILE.PROJECT().read()`
 * @param  {boolean} failSilently Don't err when dot file DNE.
 * @return {Promise<ProjectSettings>} A promise to get the project dotfile as object.
 */
export function getProjectSettings(failSilently?: boolean): Promise<ProjectSettings> {
  const promise = new Promise<ProjectSettings>((resolve, reject) => {
    const fail = (failSilently?: boolean) => {
      if (!failSilently) {
        logError(null, ERROR.SETTINGS_DNE);
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
 * Saves the script ID, rootDir in the project dotfile.
 * @param  {string} scriptId The script ID
 * @param  {string} rootDir Local root directory that store your project files
 */
export async function saveProject(scriptId: string, rootDir?: string): Promise<ProjectSettings> {
  const project: ProjectSettings = { scriptId };
  project.rootDir = project.rootDir || rootDir;
  return DOTFILE.PROJECT().write(project);
}

/**
 * Checks if the rootDir appears to be a valid project.
 * @return {boolean} True if valid project, false otherwise
 */
export const manifestExists = (rootDir: string = DOT.PROJECT.DIR): boolean =>
  fs.existsSync(path.join(rootDir, `${PROJECT_MANIFEST_BASENAME}.json`));

/**
 * Load appsscript.json manifest file.
 * @returns {Promise} A promise to get the manifest file as object.
 * @see https://developers.google.com/apps-script/concepts/manifests
 */
export async function loadManifest(): Promise<any> {
  let { rootDir } = await getProjectSettings();
  if (typeof rootDir === 'undefined') rootDir = DOT.PROJECT.DIR;
  const manifest = path.join(rootDir, `${PROJECT_MANIFEST_BASENAME}.json`);
  try {
    return JSON.parse(fs.readFileSync(manifest, 'utf8'));
  } catch(err) {
    logError(null, ERROR.NO_MANIFEST(manifest));
  }
}

/**
 * Get App Script project ID from project settings file
 * or prompt user & save
 * @returns {Promise} A promise to get the projectId string.
 */
export async function getProjectId(promptUser = true): Promise<string|undefined> {
  try {
    const projectSettings: ProjectSettings = await getProjectSettings();
    if (projectSettings.projectId) return projectSettings.projectId;
    if (!promptUser) return;
    console.log('Open this link: ', URL.SCRIPT(projectSettings.scriptId));
    console.log(`Go to *Resource > Cloud Platform Project...* and copy your projectId
(including "project-id-")\n`);
    await prompt([{
      type : 'input',
      name : 'projectId',
      message : 'What is your GCP projectId?',
    }]).then(async (answers: any) => {
      projectSettings.projectId = answers.projectId;
      await DOTFILE.PROJECT().write(projectSettings);
    });
    return projectSettings.projectId;
  } catch (err) {
    logError(null, err.message);
  }
}