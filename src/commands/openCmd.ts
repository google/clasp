/* eslint-disable new-cap,unicorn/filename-case */
import ellipsize from 'ellipsize';
import open from 'open';

import { loadAPICredentials, script } from '../auth';
import { deploymentIdPrompt } from '../inquirer';
import { URL } from '../urls';
import { ERROR, getProjectSettings, getWebApplicationURL, LOG, logError } from '../utils';

/**
 * Opens an Apps Script project's script.google.com editor.
 * @param scriptId {string} The Apps Script project to open.
 * @param cmd.webapp {boolean} If true, the command will open the webapps URL.
 * @param cmd.creds {boolean} If true, the command will open the credentials URL.
 */
export default async (
  scriptId: string,
  cmd: {
    readonly webapp: boolean;
    readonly creds: boolean;
    readonly addon: boolean;
  }
): Promise<void> => {
  const projectSettings = await getProjectSettings();
  if (!scriptId) scriptId = projectSettings.scriptId;
  if (scriptId.length < 30) logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
  // We've specified to open creds.
  if (cmd.creds) {
    const { projectId } = projectSettings;
    if (projectId) {
      console.log(LOG.OPEN_CREDS(projectId));
      await open(URL.CREDS(projectId));
      return;
    }

    logError(null, ERROR.NO_GCLOUD_PROJECT);
  }

  // We've specified to print addons and open the first one.
  if (cmd.addon) {
    const { parentId } = projectSettings;
    if (parentId && parentId.length > 0) {
      if (parentId.length > 1) {
        parentId.forEach((id) => {
          console.log(LOG.FOUND_PARENT(id));
        });
      }

      console.log(LOG.OPEN_FIRST_PARENT(parentId[0]));
      await open(URL.DRIVE(parentId[0]));
      return;
    }

    logError(null, ERROR.NO_PARENT_ID);
  }

  // If we're not a web app, open the script URL.
  if (!cmd.webapp) {
    console.log(LOG.OPEN_PROJECT(scriptId));
    await open(URL.SCRIPT(scriptId));
    return;
  }

  // Web app: Otherwise, open the latest deployment.
  await loadAPICredentials();
  const deploymentsList = await script.projects.deployments.list({ scriptId });
  if (deploymentsList.status !== 200) logError(deploymentsList.statusText);
  const deployments = deploymentsList.data.deployments ?? [];
  if (deployments.length === 0) logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
  // Order deployments by update time.
  const choices = deployments
    .slice()
    .sort((d1, d2) => {
      if (d1.updateTime && d2.updateTime) {
        return d1.updateTime.localeCompare(d2.updateTime);
      }

      return 0; // Should never happen
    })
    .map((deployment) => {
      const DESC_PAD_SIZE = 30;
      const config = deployment.deploymentConfig;
      const version = config?.versionNumber;
      return {
        name: `${ellipsize(config && config.description!, DESC_PAD_SIZE).padEnd(
          DESC_PAD_SIZE
        )}@${(typeof version === 'number' ? `${version}` : 'HEAD').padEnd(4)} - ${deployment.deploymentId}`,
        value: deployment,
      };
    });

  const answers = await deploymentIdPrompt(choices);

  const deployment = await script.projects.deployments.get({
    scriptId,
    deploymentId: answers.deployment.deploymentId as string,
  });
  console.log(LOG.OPEN_WEBAPP(answers.deployment.deploymentId as string));
  const target = getWebApplicationURL(deployment.data);
  if (target) {
    await open(target, { wait: false });
  } else {
    logError(null, `Could not open deployment: ${JSON.stringify(deployment)}`);
  }
};
