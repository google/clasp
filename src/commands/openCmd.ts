import { script_v1 } from 'googleapis';
import {
  loadAPICredentials,
  script,
} from './../auth';
import { URL } from './../urls';
import {
  ERROR,
  LOG,
  checkIfOnline,
  getProjectSettings,
  getWebApplicationURL,
  logError,
} from './../utils';

const ellipsize = require('ellipsize');
const open = require('opn');
const padEnd = require('string.prototype.padend');

// setup inquirer
const inquirer = require('inquirer');
const prompt = inquirer.prompt;
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Opens an Apps Script project's script.google.com editor.
 * @param scriptId {string} The Apps Script project to open.
 * @param cmd.webapp {boolean} If true, the command will open the webapps URL.
 * @param cmd.creds {boolean} If true, the command will open the credentials URL.
 */
export default async (scriptId: string, cmd: {
  webapp: boolean,
  creds: boolean,
}) => {
  await checkIfOnline();
  const projectSettings = await getProjectSettings();
  if (!scriptId) scriptId = projectSettings.scriptId;
  if (scriptId.length < 30) {
    return logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
  }
  // We've specified to open creds.
  if (cmd.creds) {
    const projectId = projectSettings.projectId;
    if (!projectId) {
      return logError(null, ERROR.NO_GCLOUD_PROJECT);
    }
    console.log(LOG.OPEN_CREDS(projectId));
    return open(URL.CREDS(projectId), { wait: false });
  }

  // If we're not a web app, open the script URL.
  if (!cmd.webapp) {
    console.log(LOG.OPEN_PROJECT(scriptId));
    return open(URL.SCRIPT(scriptId), { wait: false });
  }

  // Web app: Otherwise, open the latest deployment.
  await loadAPICredentials();
  const deploymentsList = await script.projects.deployments.list({
    scriptId,
  });
  if (deploymentsList.status !== 200) {
    return logError(deploymentsList.statusText);
  }
  const deployments = deploymentsList.data.deployments || [];
  if (!deployments.length) {
    logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
  }
  // Order deployments by update time.
  const orderedDeployments = deployments.sort(
    (d1: script_v1.Schema$Deployment, d2: script_v1.Schema$Deployment) => {
    if (!d1.updateTime || !d2.updateTime) {
      return 0; // should never happen
    }
    return d1.updateTime.localeCompare(d2.updateTime);
  });
  const choices = orderedDeployments.map((deployment: script_v1.Schema$Deployment) => {
    const DESC_PAD_SIZE = 30;
    const id = deployment.deploymentId;
    const deploymentConfig = deployment.deploymentConfig || {};
    const description = deploymentConfig.description;
    const versionNumber = deploymentConfig.versionNumber;
    return {
      name:
        padEnd(ellipsize(description || '', DESC_PAD_SIZE), DESC_PAD_SIZE) +
        `@${padEnd(versionNumber || 'HEAD', 4)} - ${id}`,
      value: deployment,
    };
  });
  const answers = await prompt([{
    type: 'list',
    name: 'deploymentId',
    message: 'Open which deployment?',
    choices,
  }]) as {deploymentId: string};
  const deployment = await script.projects.deployments.get({deploymentId: answers.deploymentId});
  console.log(LOG.OPEN_WEBAPP(answers.deploymentId));
  open(getWebApplicationURL(deployment.data), { wait: false });
};