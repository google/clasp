import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {PROJECT_MANIFEST_BASENAME as manifestFileName} from '../constants';
import {ERROR, LOG} from '../messages';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils';

interface CommandOption {
  readonly versionNumber?: number;
  readonly description?: string;
  readonly deploymentId?: string;
}

/**
 * Deploys an Apps Script project.
 * @param options.versionNumber {string} The project version to deploy at.
 * @param options.description   {string} The deployment description.
 * @param options.deploymentId  {string} The deployment ID to redeploy.
 */
export default async (options: CommandOption): Promise<void> => {
  await checkIfOnlineOrDie();
  await loadAPICredentials();
  const {scriptId} = await getProjectSettings();
  if (!scriptId) {
    return;
  }

  spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId)).start();

  let {versionNumber} = options;
  const {deploymentId, description = ''} = options;

  // If no version, create a new version
  if (!versionNumber) {
    const {
      data: {versionNumber: newVersionNumber},
      status,
    } = await script.projects.versions.create({requestBody: {description}, scriptId});
    if (status !== 200) {
      throw new ClaspError(ERROR.ONE_DEPLOYMENT_CREATE);
    }

    stopSpinner();

    versionNumber = newVersionNumber ?? 0;
    console.log(LOG.VERSION_CREATED(versionNumber));
  }

  spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);

  const deploymentConfig = {description, manifestFileName, versionNumber};
  // If no deploymentId, create a new deployment
  // Else, update deployment
  const {
    data: {deploymentId: newDeploymentId},
    status,
  } = deploymentId
    ? await script.projects.deployments.update({
        scriptId,
        deploymentId,
        requestBody: {deploymentConfig},
      })
    : await script.projects.deployments.create({
        scriptId,
        requestBody: deploymentConfig,
      });

  if (status !== 200) {
    throw new ClaspError(ERROR.DEPLOYMENT_COUNT);
  }

  stopSpinner();

  console.log(`- ${newDeploymentId} @${versionNumber}.`);
};
