import { DOT, PROJECT_NAME, getScriptURL } from './utils.js';
import * as pluralize from 'pluralize';

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
    DEPLOYMENT_CREATE: 'Creating deployment...',
    DEPLOYMENT_DNE: 'No deployed versions of script.',
    DEPLOYMENT_LIST: (scriptId: string) => `Listing deployments for ${scriptId}...`,
    DEPLOYMENT_START: (scriptId: string) => `Deploying project ${scriptId}...`,
    FILES_TO_PUSH: 'Files to push were:',
    FINDING_SCRIPTS: 'Finding your scripts...',
    FINDING_SCRIPTS_DNE: 'No script files found.',
    OPEN_PROJECT: (scriptId: string) => `Opening script: ${scriptId}`,
    PULLING: 'Pulling files...',
    STATUS_PUSH: 'The following files will be pushed by clasp push:',
    STATUS_IGNORE: 'Untracked files:',
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
    VERSION_DESCRIPTION: ({ versionNumber, description }: any) => `${versionNumber} - ` +
        (description || '(no description)'),
    VERSION_NUM: (numVersions: number) => `~ ${numVersions} ${pluralize('Version', numVersions)} ~`,
  };