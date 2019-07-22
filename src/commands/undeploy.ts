import { loadAPICredentials, script } from '../auth';
import { ERROR, LOG, checkIfOnline, getProjectSettings, logError, spinner } from '../utils';

/**
 * Removes a deployment from the Apps Script project.
 * @param deploymentId {string} The deployment's ID
 */
export default async (deploymentId: string, cmd: { all: boolean }) => {
  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings();
  if (!scriptId) return;
  if (cmd.all) {
    const deploymentsList = await script.projects.deployments.list({
      scriptId,
    });
    if (deploymentsList.status !== 200) logError(deploymentsList.statusText);
    const deployments = deploymentsList.data.deployments || [];
    if (!deployments.length) logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    deployments.shift(); // @HEAD (Read-only deployments) may not be deleted.
    for (const deployment of deployments) {
      const id = deployment.deploymentId || '';
      spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(id)).start();
      const result = await script.projects.deployments.delete({
        scriptId,
        deploymentId: id,
      });
      spinner.stop(true);
      if (result.status !== 200) logError(null, ERROR.READ_ONLY_DELETE);
      console.log(LOG.UNDEPLOYMENT_FINISH(id));
    }
    console.log(LOG.UNDEPLOYMENT_ALL_FINISH);
    return;
  }
  if (!deploymentId) {
    const deploymentsList = await script.projects.deployments.list({
      scriptId,
    });
    if (deploymentsList.status !== 200) logError(deploymentsList.statusText);
    const deployments = deploymentsList.data.deployments || [];
    if (!deployments.length) logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    // @HEAD (Read-only deployments) may not be deleted.
    if (deployments.length <= 1) logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    deploymentId = deployments[deployments.length - 1].deploymentId || '';
  }
  spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
  const response = await script.projects.deployments.delete({
    scriptId,
    deploymentId,
  });
  spinner.stop(true);
  if (response.status === 200) {
    console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
  } else {
    logError(null, ERROR.READ_ONLY_DELETE);
  }
};
