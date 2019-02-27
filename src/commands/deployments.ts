import { script_v1 } from 'googleapis';
import * as pluralize from 'pluralize';
import {
  loadAPICredentials,
  script,
} from './../auth';
import {
  LOG,
  checkIfOnline,
  getProjectSettings,
  logError,
  spinner,
} from './../utils';

/**
 * Lists a script's deployments.
 */
export default async () => {
  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings();
  if (!scriptId) return;
  spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId)).start();
  const deployments = await script.projects.deployments.list({
    scriptId,
  });
  spinner.stop(true);
  if (deployments.status !== 200) {
    return logError(deployments.statusText);
  }
  const deploymentsList = deployments.data.deployments || [];
  const numDeployments = deploymentsList.length;
  const deploymentWord = pluralize('Deployment', numDeployments);
  console.log(`${numDeployments} ${deploymentWord}.`);
  deploymentsList.map(({ deploymentId, deploymentConfig }: script_v1.Schema$Deployment) => {
    if (!deploymentId || !deploymentConfig) return; // fix ts errors
    const versionString = !!deploymentConfig.versionNumber ? `@${deploymentConfig.versionNumber}` : '@HEAD';
    const description = deploymentConfig.description ? '- ' + deploymentConfig.description : '';
    console.log(`- ${deploymentId} ${versionString} ${description}`);
  });
};
