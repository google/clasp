import { Conf } from './conf.js';
import { PROJECT_MANIFEST_FILENAME, PROJECT_NAME } from './constants.js';
import { URL } from './urls.js';
const config = Conf.get();
/** Human friendly Google Drive file type name */
const fileTypeName = new Map([
    ['docs', 'Google Doc'],
    ['forms', 'Google Form'],
    ['sheets', 'Google Sheet'],
    ['slides', 'Google Slide'],
]);
/**
 * Gets a human friendly Google Drive file type name.
 * @param {string} type The input file type. (i.e. docs, forms, sheets, slides)
 * @returns The name like "Google Docs".
 */
const getFileTypeName = (type) => fileTypeName.get(type);
/**
 * Gets a human friendly script type name.
 * @param {string} type The Apps Script project type. (i.e. docs, forms, sheets, slides)
 * @returns The script type (i.e. "Google Docs Add-on")
 */
const getScriptTypeName = (type) => (fileTypeName.has(type) ? `${fileTypeName.get(type)}s Add-on` : type);
// Error messages (some errors take required params)
export const ERROR = {
    ACCESS_TOKEN: 'Error retrieving access token: ',
    BAD_CREDENTIALS_FILE: 'Incorrect credentials file format.',
    BAD_REQUEST: (message) => `Error: ${message}
Your credentials may be invalid. Try logging in again.`,
    BAD_MANIFEST: `Error: Your ${PROJECT_MANIFEST_FILENAME} contains invalid JSON.`,
    COMMAND_DNE: (command) => `🤔  Unknown command "${PROJECT_NAME} ${command}"\n
Forgot ${PROJECT_NAME} commands? Get help:\n  ${PROJECT_NAME} --help`,
    CONFLICTING_FILE_EXTENSION: (name) => `File names: ${name}.js/${name}.gs conflict. Only keep one.`,
    CREATE_WITH_PARENT: 'Did you provide the correct parentId?',
    CREATE: 'Error creating script.',
    CREDENTIALS_DNE: (filename) => `Credentials file "${filename}" not found.`,
    DEPLOYMENT_COUNT: 'Unable to deploy; Scripts may only have up to 20 versioned deployments at a time.',
    DRIVE: 'Something went wrong with the Google Drive API',
    EXECUTE_ENTITY_NOT_FOUND: 'Script API executable not published/deployed.',
    FOLDER_EXISTS: () => `Project file (${config.projectConfig}) already exists.`,
    FS_DIR_WRITE: 'Could not create directory.',
    FS_FILE_WRITE: 'Could not write file.',
    INVALID_JSON: 'Input params not Valid JSON string. Please fix and try again',
    LOGGED_IN_LOCAL: 'Warning: You seem to already be logged in *locally*. You have a ./.clasprc.json',
    LOGGED_IN_GLOBAL: 'Warning: You seem to already be logged in *globally*. You have a ~/.clasprc.json',
    LOGGED_OUT: `\nCommand failed. Please login. (${PROJECT_NAME} login)`,
    LOGS_NODATA: 'StackDriver logs query returned no data.',
    LOGS_UNAVAILABLE: 'StackDriver logs are getting ready, try again soon.',
    NO_API: (enable, api) => `API ${api} doesn't exist. Try 'clasp apis ${enable ? 'enable' : 'disable'} sheets'.`,
    NO_CREDENTIALS: (local) => `Could not read API credentials. Are you logged in ${local ? 'locally' : 'globally'}?`,
    NO_FUNCTION_NAME: 'N/A',
    NO_GCLOUD_PROJECT: () => `No projectId found in your ${config.projectConfig} file.`,
    NO_PARENT_ID: () => `No parentId or empty parentId found in your ${config.projectConfig} file.`,
    NO_LOCAL_CREDENTIALS: `Requires local crendetials:\n\n  ${PROJECT_NAME} login --creds <file.json>`,
    NO_MANIFEST: (filename) => `Manifest: ${filename} invalid. \`create\` or \`clone\` a project first.`,
    NO_NESTED_PROJECTS: '\nNested clasp projects are not supported.',
    NO_VERSIONED_DEPLOYMENTS: 'No versioned deployments found in project.',
    NO_WEBAPP: (deploymentId) => `Deployment "${deploymentId}" is not deployed as WebApp.`,
    OFFLINE: 'Error: Looks like you are offline.',
    ONE_DEPLOYMENT_CREATE: 'Currently just one deployment can be created at a time.',
    PAYLOAD_UNKNOWN: 'Unknown StackDriver payload.',
    PERMISSION_DENIED_LOCAL: `Error: Permission denied. Be sure that you have:
- Added the necessary scopes needed for the API.
- Enabled the Apps Script API.
- Enable required APIs for project.`,
    PERMISSION_DENIED: `Error: Permission denied. Enable the Apps Script API:\n${URL.SCRIPT_API_USER}`,
    RATE_LIMIT: 'Rate limit exceeded. Check quota.',
    RUN_NODATA: 'Script execution API returned no data.',
    READ_ONLY_DELETE: 'Unable to delete read-only deployment.',
    SCRIPT_ID_DNE: () => `No scriptId found in your ${config.projectConfig} file.`,
    SCRIPT_ID_INCORRECT: (scriptId) => `The scriptId "${scriptId}" looks incorrect.
Did you provide the correct scriptId?`,
    SCRIPT_ID: `Could not find script.
Did you provide the correct scriptId?
Are you logged in to the correct account with the script?`,
    SETTINGS_DNE: () => `
No valid ${config.projectConfig} project file. You may need to \`create\` or \`clone\` a project first.`,
    UNAUTHENTICATED_LOCAL: 'Error: Local client credentials unauthenticated. Check scopes/authorization.',
    UNAUTHENTICATED: 'Error: Unauthenticated request: Please try again.',
    UNKNOWN_KEY: (key) => `Unknown key "${key}"`,
    PROJECT_ID_INCORRECT: (projectId) => `The projectId "${projectId}" looks incorrect.
Did you provide the correct projectID?`,
};
// Log messages (some logs take required params)
export const LOG = {
    ASK_PROJECT_ID: 'What is your GCP projectId?',
    NOT_LOGGED_IN: 'You are not logged in.',
    LOGGED_IN_UNKNOWN: 'You are logged in as an unknown user.',
    LOGGED_IN_AS: (email) => `You are logged in as ${email}.`,
    AUTH_CODE: 'Enter the code from that page here: ',
    // TODO: Make AUTH_PAGE_SUCCESSFUL show an HTML page with something useful!
    AUTH_PAGE_SUCCESSFUL: 'Logged in! You may close this page. ',
    AUTH_SUCCESSFUL: 'Authorization successful.',
    AUTHORIZE: (authUrl) => `🔑 Authorize ${PROJECT_NAME} by visiting this url:\n${authUrl}\n`,
    CLONE_SUCCESS: (fileCount) => `Warning: files in subfolder are not accounted for unless you set a '${config.ignore}' file.
Cloned ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.`,
    CLONING: 'Cloning files…',
    CLONE_SCRIPT_QUESTION: 'Clone which script?',
    CREATE_SCRIPT_QUESTION: 'Create which script?',
    CREATE_DRIVE_FILE_FINISH: (filetype, fileid) => { var _a; return `Created new ${(_a = getFileTypeName(filetype)) !== null && _a !== void 0 ? _a : '(unknown type)'}: ${URL.DRIVE(fileid)}`; },
    CREATE_DRIVE_FILE_START: (filetype) => { var _a; return `Creating new ${(_a = getFileTypeName(filetype)) !== null && _a !== void 0 ? _a : '(unknown type)'}…`; },
    CREATE_PROJECT_FINISH: (filetype, scriptId) => `Created new ${getScriptTypeName(filetype)} script: ${URL.SCRIPT(scriptId)}`,
    CREATE_PROJECT_START: (title) => `Creating new script: ${title}…`,
    CREDENTIALS_FOUND: 'Credentials found, using those to login…',
    CREDS_FROM_PROJECT: (projectId) => `Using credentials located here:\n${URL.CREDS(projectId)}\n`,
    DEFAULT_CREDENTIALS: 'No credentials given, continuing with default…',
    DEPLOYMENT_CREATE: 'Creating deployment…',
    DEPLOYMENT_DNE: 'No deployed versions of script.',
    DEPLOYMENT_LIST: (_scriptId) => 'Listing deployments…',
    DEPLOYMENT_START: (_scriptId) => 'Deploying project…',
    FILES_TO_PUSH: 'Files to push were:',
    FINDING_SCRIPTS_DNE: 'No script files found.',
    FINDING_SCRIPTS: 'Finding your scripts…',
    GRAB_LOGS: 'Grabbing logs…',
    GET_PROJECT_ID_INSTRUCTIONS: `Go to *Resource > Cloud Platform Project…* and copy your projectId
(including "project-id-")`,
    GIVE_DESCRIPTION: 'Give a description: ',
    LOCAL_CREDS: () => `Using local credentials: ${config.authLocal} 🔐 `,
    LOGIN: (isLocal) => `Logging in ${isLocal ? 'locally' : 'globally'}…`,
    LOGS_SETUP: 'Finished setting up logs.\n',
    NO_GCLOUD_PROJECT: `No projectId found. Running ${PROJECT_NAME} logs --setup.`,
    OPEN_CREDS: (projectId) => `Opening credentials page: ${URL.CREDS(projectId)}`,
    OPEN_LINK: (link) => `Open this link: ${link}`,
    OPEN_PROJECT: (scriptId) => `Opening script: ${URL.SCRIPT(scriptId)}`,
    OPEN_WEBAPP: (deploymentId) => `Opening web application: ${deploymentId}`,
    OPEN_FIRST_PARENT: (parentId) => `Opening first parent: ${URL.DRIVE(parentId)}`,
    FOUND_PARENT: (parentId) => `Found parent: ${URL.DRIVE(parentId)}`,
    PULLING: 'Pulling files…',
    PUSH_FAILURE: 'Push failed. Errors:',
    PUSH_NO_FILES: 'No files to push.',
    PUSH_SUCCESS: (filesCount) => `Pushed ${filesCount} ${filesCount === 1 ? 'file' : 'files'}.`,
    PUSH_WATCH_UPDATED: (filename) => `- Updated: ${filename}`,
    PUSH_WATCH: 'Watching for changed files…\n',
    PUSHING: 'Pushing files…',
    SAVED_CREDS: (isLocalCreds) => isLocalCreds
        ? `Local credentials saved to: ${config.authLocal}.
*Be sure to never commit this file!* It's basically a password.`
        : `Default credentials saved to: ${config.auth}.`,
    SCRIPT_LINK: (scriptId) => `https://script.google.com/d/${scriptId}/edit`,
    // SCRIPT_RUN: (functionName: string) => `Executing: ${functionName}`,
    STACKDRIVER_SETUP: 'Setting up StackDriver Logging.',
    STATUS_IGNORE: 'Ignored files:',
    STATUS_PUSH: 'Not ignored files:',
    UNDEPLOYMENT_FINISH: (deploymentId) => `Undeployed ${deploymentId}.`,
    UNDEPLOYMENT_ALL_FINISH: 'Undeployed all deployments.',
    UNDEPLOYMENT_START: (deploymentId) => `Undeploying ${deploymentId}…`,
    VERSION_CREATE: 'Creating a new version…',
    VERSION_CREATED: (versionNumber) => `Created version ${versionNumber}.`,
    VERSION_DESCRIPTION: ({ versionNumber, description }) => `${versionNumber} - ${description !== null && description !== void 0 ? description : '(no description)'}`,
    VERSION_NUM: (versionsCount) => `~ ${versionsCount} ${versionsCount === 1 ? 'Version' : 'Versions'} ~`,
    //   SETUP_LOCAL_OAUTH: (projectId: string) => `1. Create a client ID and secret:
    //     Open this link: ${chalk.blue(URL.CREDS(projectId))}
    //     Click ${chalk.cyan('Create credentials')}, then select ${chalk.yellow('OAuth client ID')}.
    //     Select ${chalk.yellow('Other')}.
    //     Give the client a ${chalk.yellow('name')}.
    //     Click ${chalk.cyan('Create')}.
    //     Click ${chalk.cyan('Download JSON')} for the new client ID: ${chalk.yellow('name')} (right-hand side).
    // 2. Authenticate clasp with your credentials json file:
    //     clasp login --creds <client_credentials.json>`,
};
//# sourceMappingURL=messages.js.map