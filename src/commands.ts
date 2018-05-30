import { DOT, PROJECT_NAME, getScriptURL,
  logError, ClaspSettings, DOTFILE, ERROR,
  checkIfOnline, spinner, saveProjectId, manifestExists,
  getProjectSettings } from './utils';
import {hasProject, fetchProject} from './files';
import { authorize, getAPICredentials, drive, script} from './auth';
import * as pluralize from 'pluralize';
const commander = require('commander');
import * as del from 'del';
const { prompt } = require('inquirer');

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

export const help = () => {
  commander.outputHelp();
};
export const defaultCmd = (command: string) => {
  console.error(ERROR.COMMAND_DNE(command));
};

export const create = async (title: string, parentId: string) => {
  await checkIfOnline();
  if (hasProject()) {
    logError(null, ERROR.FOLDER_EXISTS);
  } else {
    if (!title) {
      await prompt([{
        type : 'input',
        name : 'title',
        message : 'Give a script title:',
        default: LOG.UNTITLED_SCRIPT_TITLE,
      }]).then((answers: any) => {
        title = answers.title;
      }).catch((err: any) => {
        console.log(err);
      });
    }
    getAPICredentials(async () => {
      spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title)).start();
      try {
        const { scriptId } = await getProjectSettings(true);
        if (scriptId) {
          console.error(ERROR.NO_NESTED_PROJECTS);
          process.exit(1);
        }
      } catch (err) { // no scriptId (because project doesn't exist)
        //console.log(err);
      }
      script.projects.create({ title, parentId }, {}).then(res => {
        spinner.stop(true);
        const createdScriptId = res.data.scriptId;
        console.log(LOG.CREATE_PROJECT_FINISH(createdScriptId));
        saveProjectId(createdScriptId);
        if (!manifestExists()) {
          fetchProject(createdScriptId); // fetches appsscript.json, o.w. `push` breaks
        }
      }).catch((error: object) => {
        spinner.stop(true);
        logError(error, ERROR.CREATE);
      });
    });
  }
};
export const clone = async (scriptId: string, versionNumber?: number) => {
  await checkIfOnline();
  if (hasProject()) {
    logError(null, ERROR.FOLDER_EXISTS);
  } else {
    if (!scriptId) {
      getAPICredentials(async () => {
        const { data } = await drive.files.list({
          pageSize: 10,
          fields: 'files(id, name)',
          q: 'mimeType="application/vnd.google-apps.script"',
        });
        const files = data.files;
        if (files.length) {
          const fileIds = files.map((file: any) => {
            return {
              name: `${file.name}`.padEnd(20) + ` - (${file.id})`,
              value: file.id,
            };
          });
          await prompt([{
            type : 'list',
            name : 'scriptId',
            message : 'Clone which script? ',
            choices : fileIds,
          }]).then((answers: any) => {
            checkIfOnline();
            spinner.setSpinnerTitle(LOG.CLONING);
            saveProjectId(answers.scriptId);
            fetchProject(answers.scriptId, '', versionNumber);
          }).catch((err: any) => {
            console.log(err);
          });
        } else {
          console.log(LOG.FINDING_SCRIPTS_DNE);
        }
      });
    } else {
      spinner.setSpinnerTitle(LOG.CLONING);
      saveProjectId(scriptId);
      fetchProject(scriptId, '', versionNumber);
    }
  }
};
export const logout = () => {
  del(DOT.RC.ABSOLUTE_PATH, { force: true }); // del doesn't work with a relative path (~)
  del(DOT.RC.ABSOLUTE_LOCAL_PATH, { force: true });
};