import open from 'open';

import {OAuth2Client} from 'google-auth-library';
import {google} from 'googleapis';
import inquirer from 'inquirer';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {ClaspError} from '../clasp-error.js';
import {ProjectSettings} from '../dotfile.js';
import {ERROR, LOG} from '../messages.js';
import {URL} from '../urls.js';
import {checkIfOnlineOrDie, ellipsize, getProjectSettings, getWebApplicationURL} from '../utils.js';

interface CommandOption {
  readonly webapp?: boolean;
  readonly creds?: boolean;
  readonly addon?: boolean;
  readonly deploymentId?: string;
}

/**
 * Opens an Apps Script project's script.google.com editor.
 * @param scriptId {string} The Apps Script project to open.
 * @param options.webapp {boolean} If true, the command will open the webapps URL.
 * @param options.creds {boolean} If true, the command will open the credentials URL.
 * @param options.deploymentId {string} Use custom deployment ID with webapp.
 */
export async function openProjectCommand(scriptId: string, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();
  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();

  const projectSettings = await getProjectSettings();

  const currentScriptId = scriptId ?? projectSettings.scriptId;
  if (currentScriptId.length < 30) {
    throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(currentScriptId));
  }

  // We've specified to open creds.
  if (options.creds) {
    const {projectId} = projectSettings;
    if (!projectId) {
      throw new ClaspError(ERROR.NO_GCLOUD_PROJECT());
    }

    console.log(LOG.OPEN_CREDS(projectId));
    await open(URL.CREDS(projectId));
    return;
  }

  // We've specified to print addons and open the first one.
  if (options.addon) {
    await openAddon(projectSettings);
    return;
  }

  if (options.webapp) {
    await openWebApp(oauth2Client, currentScriptId, options.deploymentId);
    return;
  }

  // If we're not a web app, open the script URL.
  console.log(LOG.OPEN_PROJECT(currentScriptId));
  await open(URL.SCRIPT(currentScriptId));
}

async function openAddon(projectSettings: ProjectSettings) {
  const {parentId: parentIdList = []} = projectSettings;

  if (parentIdList.length === 0) {
    throw new ClaspError(ERROR.NO_PARENT_ID());
  }

  if (parentIdList.length > 1) {
    parentIdList.forEach(id => console.log(LOG.FOUND_PARENT(id)));
  }

  const parentId = parentIdList[0];
  console.log(LOG.OPEN_FIRST_PARENT(parentId));
  await open(URL.DRIVE(parentId));
}

async function openWebApp(oauth2Client: OAuth2Client, scriptId: string, optionsDeploymentId?: string) {
  // Web app: open the latest deployment.
  const script = google.script({version: 'v1', auth: oauth2Client});

  const res = await script.projects.deployments.list({scriptId});
  const deployments = res.data.deployments ?? [];

  if (deployments.length === 0) {
    throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  }

  let deploymentId = optionsDeploymentId;
  if (!deploymentId) {
    // Order deployments by update time.
    deployments.sort((a, b) => (a.updateTime && b.updateTime ? a.updateTime.localeCompare(b.updateTime) : 0));
    const choices = deployments.map(value => {
      const description = ellipsize(value.deploymentConfig?.description ?? '', 30);
      const versionNumber = (value.deploymentConfig?.versionNumber?.toString() ?? 'HEAD').padEnd(4);
      const name = `${description}@${versionNumber}} - ${value.deploymentId}`;
      return {name, value};
    });

    const answer = await inquirer.prompt([
      {
        choices,
        message: 'Open which deployment?',
        name: 'deployment',
        type: 'list',
      },
    ]);

    deploymentId = answer.deployment;
  }
  const deploymentResponse = await script.projects.deployments.get({scriptId, deploymentId});
  console.log(LOG.OPEN_WEBAPP(deploymentId));
  const target = getWebApplicationURL(deploymentResponse.data);
  if (!target) {
    throw new ClaspError(`Could not open deployment ${deploymentId}`);
  }

  await open(target, {wait: false});
}
