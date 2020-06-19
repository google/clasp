import {script_v1 as scriptV1} from 'googleapis';
import open from 'open';

import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {ProjectSettings} from '../dotfile';
import {deploymentIdPrompt, DeploymentIdPromptChoice} from '../inquirer';
import {ERROR, LOG} from '../messages';
import {URL} from '../urls';
import {ellipsize, getProjectSettings, getWebApplicationURL} from '../utils';

interface CommandOption {
  readonly webapp?: boolean;
  readonly creds?: boolean;
  readonly addon?: boolean;
  readonly deploymentId?: string;
}

const getDeploymentId = async (choices: DeploymentIdPromptChoice[]): Promise<string> => {
  const {
    deployment: {deploymentId: depIdFromPrompt},
  } = await deploymentIdPrompt(choices);

  return depIdFromPrompt as string;
};

/**
 * Opens an Apps Script project's script.google.com editor.
 * @param scriptId {string} The Apps Script project to open.
 * @param options.webapp {boolean} If true, the command will open the webapps URL.
 * @param options.creds {boolean} If true, the command will open the credentials URL.
 * @param options.deploymentId {string} Use custom deployment ID with webapp.
 */
export default async (scriptId: string, options: CommandOption): Promise<void> => {
  const projectSettings = await getProjectSettings();

  const currentScriptId = scriptId ?? projectSettings.scriptId;

  if (currentScriptId.length < 30) {
    throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(currentScriptId));
  }

  // We've specified to open creds.
  if (options.creds) {
    const {projectId} = projectSettings;
    if (!projectId) {
      throw new ClaspError(ERROR.NO_GCLOUD_PROJECT);
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
    await openWebApp(currentScriptId, options.deploymentId);
    return;
  }

  // If we're not a web app, open the script URL.
  console.log(LOG.OPEN_PROJECT(currentScriptId));
  await open(URL.SCRIPT(currentScriptId));
};

const openAddon = async (projectSettings: ProjectSettings) => {
  const {parentId} = projectSettings;
  if (!parentId || parentId.length === 0) {
    throw new ClaspError(ERROR.NO_PARENT_ID);
  }

  if (parentId.length > 1) {
    parentId.forEach(id => {
      console.log(LOG.FOUND_PARENT(id));
    });
  }

  console.log(LOG.OPEN_FIRST_PARENT(parentId[0]));
  await open(URL.DRIVE(parentId[0]));
  return;
};

const openWebApp = async (scriptId: string, optionsDeploymentId?: string) => {
  // Web app: open the latest deployment.
  await loadAPICredentials();
  const deploymentsList = await script.projects.deployments.list({scriptId});
  if (deploymentsList.status !== 200) {
    throw new ClaspError(deploymentsList.statusText);
  }

  const deployments: Array<Readonly<scriptV1.Schema$Deployment>> = deploymentsList.data.deployments ?? [];
  if (deployments.length === 0) {
    throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  }

  // Order deployments by update time.
  const choices = deployments.slice();
  choices.sort((a, b) => (a.updateTime && b.updateTime ? a.updateTime.localeCompare(b.updateTime) : 0));
  const prompts = choices.map(value => {
    const {description, versionNumber = 'HEAD'} = value.deploymentConfig!;
    const name = `${ellipsize(description!, 30)}@${`${versionNumber}`.padEnd(4)} - ${value.deploymentId}`;
    return {name, value};
  });

  const deploymentId = optionsDeploymentId ?? (await getDeploymentId(prompts));

  const deployment = await script.projects.deployments.get({scriptId, deploymentId});
  console.log(LOG.OPEN_WEBAPP(deploymentId));
  const target = getWebApplicationURL(deployment.data);
  if (!target) {
    throw new ClaspError(`Could not open deployment: ${JSON.stringify(deployment)}`);
  }

  await open(target, {wait: false});
};
