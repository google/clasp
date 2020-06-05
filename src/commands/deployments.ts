import {script_v1 as scriptV1} from 'googleapis';

import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {LOG} from '../messages';
import {checkIfOnline, getProjectSettings, spinner} from '../utils';

/**
 * Lists a script's deployments.
 */
export default async (): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  const {scriptId} = await getProjectSettings();
  if (!scriptId) return;
  spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId)).start();
  const deployments = await script.projects.deployments.list({
    scriptId,
  });
  if (spinner.isSpinning()) spinner.stop(true);
  if (deployments.status !== 200) throw new ClaspError(deployments.statusText);
  const deploymentsList = deployments.data.deployments ?? [];
  const deploymentCount = deploymentsList.length;
  const deploymentWord = deploymentCount === 1 ? 'Deployment' : 'Deployments';
  console.log(`${deploymentCount} ${deploymentWord}.`);
  deploymentsList.forEach(({deploymentId, deploymentConfig}: Readonly<scriptV1.Schema$Deployment>) => {
    if (!deploymentId || !deploymentConfig) return; // Fix ts errors
    const versionString = deploymentConfig.versionNumber ? `@${deploymentConfig.versionNumber}` : '@HEAD';
    const description = deploymentConfig.description ? `- ${deploymentConfig.description}` : '';
    console.log(`- ${deploymentId} ${versionString} ${description}`);
  });
};
