import {google} from 'googleapis';
import {getAuthorizedOAuth2Client} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {ERROR, LOG} from '../messages.js';
import {getProjectSettings, spinner, stopSpinner} from '../utils.js';

/**
 * Lists a script's deployments.
 */
export async function listDeploymentsCommand(): Promise<void> {
  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS(false));
  }
  const script = google.script({version: 'v1', auth: oauth2Client});

  const {scriptId} = await getProjectSettings();
  if (scriptId) {
    spinner.start(LOG.DEPLOYMENT_LIST(scriptId));

    const {
      data: {deployments = []},
      status,
      statusText,
    } = await script.projects.deployments.list({scriptId});

    stopSpinner();

    if (status !== 200) {
      throw new ClaspError(statusText);
    }

    const deploymentCount = deployments.length;
    console.log(`${deploymentCount} ${deploymentCount === 1 ? 'Deployment' : 'Deployments'}.`);
    for (const {deploymentId, deploymentConfig} of deployments) {
      if (deploymentId && deploymentConfig) {
        const versionString = deploymentConfig.versionNumber ? `@${deploymentConfig.versionNumber}` : '@HEAD';
        const description = deploymentConfig.description ? `- ${deploymentConfig.description}` : '';
        console.log(`- ${deploymentId} ${versionString} ${description}`);
      }
    }
  }
}
