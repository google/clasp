import {google} from 'googleapis';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils.js';

/**
 * Lists a script's deployments.
 */
export async function listDeploymentsCommand(): Promise<void> {
  await checkIfOnlineOrDie();

  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();
  const script = google.script({version: 'v1', auth: oauth2Client});

  const {scriptId} = await getProjectSettings();
  spinner.start(LOG.DEPLOYMENT_LIST(scriptId));

  const res = await script.projects.deployments.list({scriptId});
  stopSpinner();

  const deployments = res.data.deployments ?? [];

  if (!deployments.length) {
    console.log('No deployments.');
    return;
  }

  console.log(`${deployments.length} ${deployments.length === 1 ? 'Deployment' : 'Deployments'}.`);
  deployments
    .filter(d => d.deploymentConfig && d.deploymentId)
    .forEach(d => {
      const versionString = d.deploymentConfig?.versionNumber ? `@${d.deploymentConfig.versionNumber}` : '@HEAD';
      const description = d.deploymentConfig?.description ? `- ${d.deploymentConfig.description}` : '';
      console.log(`- ${d.deploymentId} ${versionString} ${description}`);
    });
}
