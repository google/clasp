import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {ERROR, LOG} from '../messages';
import {checkIfOnline, getProjectSettings, spinner, stopSpinner} from '../utils';

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
    if (deploymentsList.status !== 200) throw new ClaspError(deploymentsList.statusText);

    const deployments = deploymentsList.data.deployments ?? [];
    if (deployments.length === 0) throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));

    deployments.shift(); // @HEAD (Read-only deployments) may not be deleted.
    for (const deployment of deployments) {
      const id = deployment.deploymentId ?? '';
      spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(id)).start();
      const result = await script.projects.deployments.delete({scriptId, deploymentId: id});

      if (result.status !== 200) throw new ClaspError(ERROR.READ_ONLY_DELETE);

      stopSpinner();
      console.log(LOG.UNDEPLOYMENT_FINISH(id));
    }
    console.log(LOG.UNDEPLOYMENT_ALL_FINISH);
    return;
  }

  if (!deploymentId) {
    const deploymentsList = await script.projects.deployments.list({scriptId});
    if (deploymentsList.status !== 200) throw new ClaspError(deploymentsList.statusText);

    const deployments = deploymentsList.data.deployments ?? [];
    if (deployments.length === 0) throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));

    // @HEAD (Read-only deployments) may not be deleted.
    if (deployments.length <= 1) throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));

    deploymentId = deployments[deployments.length - 1].deploymentId ?? '';
  }
  spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
  const response = await script.projects.deployments.delete({
    scriptId,
    deploymentId,
  });
  if (response.status === 200) {
    stopSpinner();
    console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
  } else {
    throw new ClaspError(ERROR.READ_ONLY_DELETE);
  }
};
