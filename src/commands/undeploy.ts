import {google, script_v1 as scriptV1} from 'googleapis';
import pMap from 'p-map';

import {OAuth2Client} from 'google-auth-library';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {ClaspError} from '../clasp-error.js';
import {ERROR, LOG} from '../messages.js';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils.js';

interface CommandOption {
  readonly all?: boolean;
}

/**
 * Removes a deployment from the Apps Script project.
 * @param deploymentId {string} The deployment's ID
 */
export async function undeployCommand(deploymentId: string | undefined, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();
  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();

  const {scriptId} = await getProjectSettings();

  if (options.all) {
    const mapper = async ({deploymentId}: scriptV1.Schema$Deployment) =>
      deleteDeployment(oauth2Client, scriptId, deploymentId!);
    const deployments = await listDeployments(oauth2Client, scriptId);
    if (deployments.length === 0) {
      throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }

    deployments.shift(); // @HEAD (Read-only deployments) may not be deleted.

    spinner.start(LOG.UNDEPLOYMENT_START('all'));
    await pMap(deployments, mapper, {concurrency: 4});
    stopSpinner();

    console.log(LOG.UNDEPLOYMENT_ALL_FINISH);
    return;
  }

  if (!deploymentId) {
    const deployments = await listDeployments(oauth2Client, scriptId);
    // @HEAD (Read-only deployments) may not be deleted.
    deployments.shift();

    const lastDeployment = deployments.pop();
    if (!lastDeployment || !lastDeployment.deploymentId) {
      // TODO - More specific error message (or treat as non-error)
      throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }
    deploymentId = lastDeployment.deploymentId;
  }

  spinner.start(LOG.UNDEPLOYMENT_START(deploymentId));
  await deleteDeployment(oauth2Client, scriptId, deploymentId);
  stopSpinner();
}

async function deleteDeployment(oauth2Client: OAuth2Client, scriptId: string, deploymentId: string) {
  const script = google.script({version: 'v1', auth: oauth2Client});
  await script.projects.deployments.delete({scriptId, deploymentId});
  console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
}

async function listDeployments(oauth2Client: OAuth2Client, scriptId: string) {
  const script = google.script({version: 'v1', auth: oauth2Client});
  const res = await script.projects.deployments.list({scriptId});
  return res.data.deployments ?? [];
}
