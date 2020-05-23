/* eslint-disable new-cap */
import {loadAPICredentials, script} from '../auth';
import {ERROR, LOG} from '../messages';
import {checkIfOnline, getDescriptionFrom, getProjectSettings, logError, spinner} from '../utils';

interface CommandOption {
  readonly all?: boolean;
}

/**
 * Removes a deployment from the Apps Script project.
 * @param deploymentId {string} The deployment's ID
 */
export default async (deploymentId: string | undefined, options: CommandOption): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  const {scriptId} = await getProjectSettings();
  if (!scriptId) return;

  if (options.all) {
    const deploymentsList = await script.projects.deployments.list({scriptId});
    if (deploymentsList.status !== 200) logError(getDescriptionFrom(deploymentsList.statusText));

    const deployments = deploymentsList.data.deployments ?? [];
    if (deployments.length === 0) logError(ERROR.SCRIPT_ID_INCORRECT(scriptId));

    deployments.shift(); // @HEAD (Read-only deployments) may not be deleted.
    for (const deployment of deployments) {
      const id = deployment.deploymentId ?? '';
      spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(id)).start();
      const result = await script.projects.deployments.delete({scriptId, deploymentId: id});

      if (result.status !== 200) logError(ERROR.READ_ONLY_DELETE);

      if (spinner.isSpinning()) spinner.stop(true);
      console.log(LOG.UNDEPLOYMENT_FINISH(id));
    }
    console.log(LOG.UNDEPLOYMENT_ALL_FINISH);
    return;
  }

  if (!deploymentId) {
    const deploymentsList = await script.projects.deployments.list({scriptId});
    if (deploymentsList.status !== 200) logError(getDescriptionFrom(deploymentsList.statusText));

    const deployments = deploymentsList.data.deployments ?? [];
    if (deployments.length === 0) logError(ERROR.SCRIPT_ID_INCORRECT(scriptId));

    // @HEAD (Read-only deployments) may not be deleted.
    if (deployments.length <= 1) logError(ERROR.SCRIPT_ID_INCORRECT(scriptId));

    deploymentId = deployments[deployments.length - 1].deploymentId ?? '';
  }
  spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
  const response = await script.projects.deployments.delete({
    scriptId,
    deploymentId,
  });
  if (response.status === 200) {
    if (spinner.isSpinning()) spinner.stop(true);
    console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
  } else {
    logError(ERROR.READ_ONLY_DELETE);
  }
};
