import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { Spinner } from 'cli-spinner';
import { script_v1 } from 'googleapis';
import { prompt } from 'inquirer';
import * as pluralize from 'pluralize';
import { ClaspToken, DOT, DOTFILE, ProjectSettings } from './dotfile';
import { URL } from './urls';

const ucfirst = require('ucfirst');
const isOnline = require('is-online');

// Names / Paths
export const PROJECT_NAME = 'clasp';
export const PROJECT_MANIFEST_BASENAME = 'appsscript';
export const PROJECT_MANIFEST_FILENAME = PROJECT_MANIFEST_BASENAME + '.json';

/**
 * The installed credentials. This is a file downloaded from console.developers.google.com
 * Credentials > OAuth 2.0 client IDs > Type:Other > Download
 * Usually called: creds.json
 * @see https://console.developers.google.com/apis/credentials
 */
interface ClaspCredentialsInstalled {
  client_id: string;
  project_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_secret: string;
  redirect_uris: string[];
}
export interface ClaspCredentials {
  installed: ClaspCredentialsInstalled;
}

/**
 * Checks if OAuth client settings rc file exists.
 * @param  {boolean} local check ./clasprc.json instead of ~/.clasprc.json
 * @return {boolean}
 */
export const hasOauthClientSettings = (local = false): boolean =>
  local ? fs.existsSync(DOT.RC.ABSOLUTE_LOCAL_PATH) : fs.existsSync(DOT.RC.ABSOLUTE_PATH);

/**
 * Gets the OAuth client settings from rc file.
 * @param {boolean} local If true, gets the local OAuth settings. Global otherwise.
 * Should be used instead of `DOTFILE.RC?().read()`
 * @returns {Promise<ClaspToken>} A promise to get the rc file as object.
 */
export function getOAuthSettings(local: boolean): Promise<ClaspToken> {
  const RC = (local) ? DOTFILE.RC_LOCAL() : DOTFILE.RC;
  return RC.read()
    .then((rc: ClaspToken) => rc)
    .catch((err: Error) => {
      logError(err, ERROR.NO_CREDENTIALS(local));
    });
}

// Error messages (some errors take required params)
export const ERROR = {
  ACCESS_TOKEN: `Error retrieving access token: `,
  BAD_CREDENTIALS_FILE: 'Incorrect credentials file format.',
  BAD_REQUEST: (message: string) => `Error: ${message}
Your credentials may be invalid. Try logging in again.`,
  BAD_MANIFEST: `Error: Your ${PROJECT_MANIFEST_FILENAME} contains invalid JSON.`,
  COMMAND_DNE: (command: string) => `🤔  Unknown command "${PROJECT_NAME} ${command}"\n
Forgot ${PROJECT_NAME} commands? Get help:\n  ${PROJECT_NAME} --help`,
  CONFLICTING_FILE_EXTENSION: (name: string) => `File names: ${name}.js/${name}.gs conflict. Only keep one.`,
  CREATE_WITH_PARENT: 'Did you provide the correct parentId?',
  CREATE: 'Error creating script.',
  CREDENTIALS_DNE: (filename: string) => `Credentials file "${filename}" not found.`,
  DEPLOYMENT_COUNT: `Unable to deploy; Scripts may only have up to 20 versioned deployments at a time.`,
  DRIVE: `Something went wrong with the Google Drive API`,
  EXECUTE_ENTITY_NOT_FOUND: `Script API executable not published/deployed.`,
  // FOLDER_EXISTS: `Project file already exists.`, // TEMP!
  FOLDER_EXISTS: `Project file (${DOT.PROJECT.PATH}) already exists.`,
  FS_DIR_WRITE: 'Could not create directory.',
  FS_FILE_WRITE: 'Could not write file.',
  LOGGED_IN_LOCAL: `Warning: You seem to already be logged in *locally*. You have a ./.clasprc.json`,
  LOGGED_IN_GLOBAL: `Warning: You seem to already be logged in *globally*. You have a ~/.clasprc.json`,
  LOGGED_OUT: `\nCommand failed. Please login. (${PROJECT_NAME} login)`,
  LOGS_NODATA: 'StackDriver logs query returned no data.',
  LOGS_UNAVAILABLE: 'StackDriver logs are getting ready, try again soon.',
  NO_API: (enable: boolean, api: string) =>
    `API ${api} doesn\'t exist. Try \'clasp apis ${enable ? 'enable' : 'disable'} sheets\'.`,
  NO_CREDENTIALS: (local: boolean) => `Could not read API credentials. ` +
    `Are you logged in ${local ? 'locall' : 'globall'}y?`,
  NO_FUNCTION_NAME: 'N/A',
  NO_GCLOUD_PROJECT: `No projectId found in your ${DOT.PROJECT.PATH} file.`,
  NO_LOCAL_CREDENTIALS: `Requires local crendetials:\n\n  ${PROJECT_NAME} login --creds <file.json>`,
  NO_MANIFEST: (filename: string) =>
    `Manifest: ${filename} invalid. \`create\` or \`clone\` a project first.`,
  NO_NESTED_PROJECTS: '\nNested clasp projects are not supported.',
  NO_VERSIONED_DEPLOYMENTS: `No versioned deployments found in project.`,
  NO_WEBAPP: (deploymentId: string) => `Deployment "${deploymentId}" is not deployed as WebApp.`,
  OFFLINE: 'Error: Looks like you are offline.',
  ONE_DEPLOYMENT_CREATE: 'Currently just one deployment can be created at a time.',
  PAYLOAD_UNKNOWN: 'Unknown StackDriver payload.',
  PERMISSION_DENIED_LOCAL: `Error: Permission denied. Be sure that you have:\n` +
    `- Added the necessary scopes needed for the API.\n` +
    `- Enabled the Apps Script API.\n` +
    `- Enable required APIs for project.`,
  PERMISSION_DENIED: `Error: Permission denied. Enable the Apps Script API:\n${URL.SCRIPT_API_USER}`,
  RATE_LIMIT: 'Rate limit exceeded. Check quota.',
  RUN_NODATA: 'Script execution API returned no data.',
  READ_ONLY_DELETE: 'Unable to delete read-only deployment.',
  SCRIPT_ID_DNE: `No scriptId found in your ${DOT.PROJECT.PATH} file.`,
  SCRIPT_ID_INCORRECT: (scriptId: string) => `The scriptId "${scriptId}" looks incorrect.
Did you provide the correct scriptId?`,
  SCRIPT_ID: `Could not find script.
Did you provide the correct scriptId?
Are you logged in to the correct account with the script?`,
  SETTINGS_DNE: `\nNo ${DOT.PROJECT.PATH} settings found. \`create\` or \`clone\` a project first.`,
  UNAUTHENTICATED_LOCAL: `Error: Local client credentials unauthenticated. Check scopes/authorization.`,
  UNAUTHENTICATED: 'Error: Unauthenticated request: Please try again.',
  UNKNOWN_KEY: (key: string) => `Unknown key "${key}"`,
  PROJECT_ID_INCORRECT: (projectId: string) => `The projectId "${projectId}" looks incorrect.
Did you provide the correct projectID?`,
};

// Log messages (some logs take required params)
export const LOG = {
  AUTH_CODE: 'Enter the code from that page here: ',
  // TODO: Make AUTH_PAGE_SUCCESSFUL show an HTML page with something useful!
  AUTH_PAGE_SUCCESSFUL: `Logged in! You may close this page. `, // HTML Redirect Page
  AUTH_SUCCESSFUL: `Authorization successful.`,
  AUTHORIZE: (authUrl: string) => `🔑 Authorize ${PROJECT_NAME} by visiting this url:\n${authUrl}\n`,
  CLONE_SUCCESS: (fileNum: number) => `Cloned ${fileNum} ${pluralize('files', fileNum)}.`,
  CLONING: 'Cloning files...',
  CLONE_SCRIPT_QUESTION: 'Clone which script?',
  CREATE_DRIVE_FILE_FINISH: (filetype: string, fileid: string) =>
    `Created new ${getFileTypeName(filetype) || '(unknown type)'}: ${URL.DRIVE(fileid)}`,
  CREATE_DRIVE_FILE_START: (filetype: string) =>
    `Creating new ${getFileTypeName(filetype) || '(unknown type)'}...`,
  CREATE_PROJECT_FINISH: (filetype: string, scriptId: string) =>
    `Created new ${getScriptTypeName(filetype)} script: ${URL.SCRIPT(scriptId)}`,
  CREATE_PROJECT_START: (title: string) => `Creating new script: ${title}...`,
  CREDENTIALS_FOUND: 'Credentials found, using those to login...',
  CREDS_FROM_PROJECT: (projectId: string) => `Using credentials located here:\n${URL.CREDS(projectId)}\n`,
  DEFAULT_CREDENTIALS: 'No credentials given, continuing with default...',
  DEPLOYMENT_CREATE: 'Creating deployment...',
  DEPLOYMENT_DNE: 'No deployed versions of script.',
  DEPLOYMENT_LIST: (scriptId: string) => `Listing deployments...`,
  DEPLOYMENT_START: (scriptId: string) => `Deploying project...`,
  FILES_TO_PUSH: 'Files to push were:',
  FINDING_SCRIPTS_DNE: 'No script files found.',
  FINDING_SCRIPTS: 'Finding your scripts...',
  GRAB_LOGS: 'Grabbing logs...',
  GIVE_DESCRIPTION: 'Give a description: ',
  LOCAL_CREDS: `Using local credentials: ${DOT.RC.LOCAL_DIR}${DOT.RC.NAME} 🔐 `,
  LOGIN: (isLocal: boolean) => `Logging in ${isLocal ? 'locally' : 'globally'}...`,
  LOGS_SETUP: 'Finished setting up logs.\n',
  NO_GCLOUD_PROJECT: `No projectId found. Running ${PROJECT_NAME} logs --setup.`,
  OPEN_CREDS: (projectId: string) => `Opening credentials page: ${URL.CREDS(projectId)}`,
  OPEN_PROJECT: (scriptId: string) => `Opening script: ${URL.SCRIPT(scriptId)}`,
  OPEN_WEBAPP: (deploymentId?: string) => `Opening web application: ${deploymentId}`,
  PULLING: 'Pulling files...',
  PUSH_FAILURE: 'Push failed. Errors:',
  PUSH_SUCCESS: (numFiles: number) => `Pushed ${numFiles} ${pluralize('files', numFiles)}.`,
  PUSH_WATCH_UPDATED: (filename: string) => `- Updated: ${filename}`,
  PUSH_WATCH: 'Watching for changed files...\n',
  PUSHING: 'Pushing files...',
  SAVED_CREDS: (isLocalCreds: boolean) =>
    isLocalCreds
      ? `Local credentials saved to: ${DOT.RC.LOCAL_DIR}${DOT.RC.ABSOLUTE_LOCAL_PATH}.\n` +
      `*Be sure to never commit this file!* It's basically a password.`
      : `Default credentials saved to: ${DOT.RC.PATH} (${DOT.RC.ABSOLUTE_PATH}).`,
  SCRIPT_LINK: (scriptId: string) => `https://script.google.com/d/${scriptId}/edit`,
  SCRIPT_RUN: (functionName: string) => `Executing: ${functionName}`,
  STACKDRIVER_SETUP: 'Setting up StackDriver Logging.',
  STATUS_IGNORE: 'Ignored files:',
  STATUS_PUSH: 'Not ignored files:',
  UNDEPLOYMENT_FINISH: (deploymentId: string) => `Undeployed ${deploymentId}.`,
  UNDEPLOYMENT_ALL_FINISH: `Undeployed all deployments.`,
  UNDEPLOYMENT_START: (deploymentId: string) => `Undeploying ${deploymentId}...`,
  VERSION_CREATE: 'Creating a new version...',
  VERSION_CREATED: (versionNumber: number) => `Created version ${versionNumber}.`,
  VERSION_DESCRIPTION: ({ versionNumber, description }: script_v1.Schema$Version) =>
    `${versionNumber} - ` + (description || '(no description)'),
  VERSION_NUM: (numVersions: number) => `~ ${numVersions} ${pluralize('Version', numVersions)} ~`,
  SETUP_LOCAL_OAUTH: (projectId: string) => `1. Create a client ID and secret:
    Open this link: ${chalk.blue(URL.CREDS(projectId))}
    Click ${chalk.cyan('Create credentials')}, then select ${chalk.yellow('OAuth client ID')}.
    Select ${chalk.yellow('Other')}.
    Give the client a ${chalk.yellow('name')}.
    Click ${chalk.cyan('Create')}.
    Click ${chalk.cyan('Download JSON')} for the new client ID: ${chalk.yellow('name')} (right-hand side).

2. Authenticate clasp with your credentials json file:
    clasp login --creds <client_credentials.json>`,
};

export const spinner = new Spinner();

/**
 * Logs errors to the user such as unauthenticated or permission denied
 * @param  {object} err         The object from the request's error
 * @param  {string} description The description of the error
 */
// tslint:disable-next-line:no-any
export const logError = (err: any, description = '') => {
  spinner.stop(true);
  // Errors are weird. The API returns interesting error structures.
  // TODO(timmerman) This will need to be standardized. Waiting for the API to
  // change error model. Don't review this method now.
  if (err && typeof err.error === 'string') {
    logError(null, JSON.parse(err.error).error);
  } else if (
    (err && err.statusCode === 401) ||
    (err && err.error && err.error.error && err.error.error.code === 401)
  ) {
    // TODO check if local creds exist:
    //  localOathSettingsExist() ? ERROR.UNAUTHENTICATED : ERROR.UNAUTHENTICATED_LOCAL
    logError(null, ERROR.UNAUTHENTICATED);
  } else if (err && ((err.error && err.error.code === 403) || err.code === 403)) {
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
export function getWebApplicationURL(deployment: script_v1.Schema$Deployment) {
  const entryPoints = deployment.entryPoints || [];
  const webEntryPoint = entryPoints.find((entryPoint: script_v1.Schema$EntryPoint) =>
    entryPoint.entryPointType === 'WEB_APP');
  if (!webEntryPoint) {
    logError(null, ERROR.NO_WEBAPP(deployment.deploymentId || ''));
  }
  return webEntryPoint && webEntryPoint.webApp && webEntryPoint.webApp.url;
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
export async function getProjectSettings(failSilently?: boolean): Promise<ProjectSettings> {
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
      dotfile
        .read()
        .then((settings: ProjectSettings) => {
          // Settings must have the script ID. Otherwise we err.
          if (settings.scriptId) {
            resolve(settings);
          } else {
            // TODO: Better error message
            fail(); // Script ID DNE
          }
        })
        .catch((err: object) => {
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
 * @param  {string} filePath  The file path
 * @return {string}           The API's FileType enum (uppercase), null if not valid.
 */
export function getAPIFileType(filePath: string): string {
  const extension = filePath.substr(filePath.lastIndexOf('.') + 1).toUpperCase();
  return extension === 'GS' || extension === 'JS' ? 'SERVER_JS' : extension;
}

/**
 * Checks if the network is available. Gracefully exits if not.
 */
export async function checkIfOnline() {
  // If using a proxy, return true since `isOnline` doesn't work.
  // @see https://github.com/googleapis/google-api-nodejs-client#using-a-proxy
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    return true;
  }
  if (!(await isOnline())) {
    logError(null, ERROR.OFFLINE);
    process.exit(1);
  }
}

/**
 * Saves the project settings in the project dotfile.
 * @param {ProjectSettings} newProjectSettings The project settings
 * @param {boolean} append Appends the settings if true.
 */
export async function saveProject(
  newProjectSettings: ProjectSettings,
  append = true): Promise<ProjectSettings> {
  if (append) {
    const projectSettings: ProjectSettings = await DOTFILE.PROJECT().read();
    newProjectSettings = { ...projectSettings, ...newProjectSettings };
  }
  return DOTFILE.PROJECT().write(newProjectSettings);
}

/**
 * Gets the script's Cloud Platform Project Id from project settings file or prompt for one.
 * @returns {Promise<string>} A promise to get the projectId string.
 */
export async function getProjectId(promptUser = true): Promise<string> {
  try {
    const projectSettings: ProjectSettings = await getProjectSettings();
    if (projectSettings.projectId) return projectSettings.projectId;
    if (!promptUser) throw new Error('Project ID not found.');
    console.log('Open this link: ', URL.SCRIPT(projectSettings.scriptId));
    console.log(`Go to *Resource > Cloud Platform Project...* and copy your projectId
(including "project-id-")\n`);
    await prompt([{
      type: 'input',
      name: 'projectId',
      message: 'What is your GCP projectId?',
    // tslint:disable-next-line:no-any
    }]).then(async (answers: any) => {
      projectSettings.projectId = answers.projectId;
      await DOTFILE.PROJECT().write(projectSettings);
    });
    return projectSettings.projectId || '';
  } catch (err) {
    logError(null, err.message);
  }
  throw Error('Project ID not found');
}

/**
 * Gets a human friendly Google Drive file type name.
 * @param {string} type The input file type. (i.e. docs, forms, sheets, slides)
 * @returns The name like "Google Docs".
 */
function getFileTypeName(type: string) {
  const name: { [key: string]: string } = {
    docs: 'Google Doc',
    forms: 'Google Form',
    sheets: 'Google Sheet',
    slides: 'Google Slide',
  };
  return name[type];
}

/**
 * Gets a human friendly script type name.
 * @param {string} type The Apps Script project type. (i.e. docs, forms, sheets, slides)
 * @returns The script type (i.e. "Google Docs Add-on")
 */
function getScriptTypeName(type: string) {
  const fileType = getFileTypeName(type);
  return fileType ? `${fileType}s Add-on` : type;
}

/**
 * Handles error of each command.
 */
// tslint:disable-next-line:no-any
export function handleError(command: (...args: any[]) => Promise<void>) {
  // tslint:disable-next-line:no-any
  return async (...args: any[]) => {
    try {
      await command(...args);
    } catch (e) {
      spinner.stop(true);
      logError(null, e.message);
    }
  };
}

/**
 * Validate the project id.
 * @param {string} projectId The project id.
 * @returns {boolean} Is the project id valid
 */
export function isValidProjectId(projectId: string) {
  return new RegExp(/^[a-z][a-z0-9\-]{5,29}$/).test(projectId);
}