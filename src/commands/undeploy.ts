import script_v1 from 'googleapis';
import pMap from 'p-map';

import { loadAPICredentials, script } from '../auth';
import { checkIfOnline, ERROR, ExitAndLogError, getProjectSettings, LOG, spinner, getErrorDescription } from '../utils';

/**
 * Removes a deployment from the Apps Script project.
 * @param deploymentId {string} The deployment's ID
 */
export default async (deploymentId: string, cmd: { all: boolean }): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  const settings = await getProjectSettings();
  const scriptId = settings?.scriptId;
  if (!scriptId) return;
  if (cmd.all) {
    const deploymentsList = await script.projects.deployments.list({
      scriptId,
    });
    if (deploymentsList.status !== 200) {
      // logError(deploymentsList.statusText);
      throw new ExitAndLogError(1, getErrorDescription(deploymentsList.statusText));
    }

    const deployments = deploymentsList.data.deployments || [];
    if (deployments.length === 0) {
      // logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
      throw new ExitAndLogError(1, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }

    deployments.shift(); // @HEAD (Read-only deployments) may not be deleted.

    const mapper = async (deployment: script_v1.script_v1.Schema$Deployment): Promise<void> => {
      const id = deployment.deploymentId || '';
      spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(id)).start();
      const result = await script.projects.deployments.delete({
        scriptId,
        deploymentId: id,
      });
      if (spinner.isSpinning()) spinner.stop(true);
      if (result.status !== 200) {
        // logError(null, ERROR.READ_ONLY_DELETE);
        throw new ExitAndLogError(1, ERROR.READ_ONLY_DELETE);
      }

      console.log(LOG.UNDEPLOYMENT_FINISH(id));
    };

    await pMap(deployments, mapper);
    console.log(LOG.UNDEPLOYMENT_ALL_FINISH);
    return;
  }

  if (!deploymentId) {
    const deploymentsList = await script.projects.deployments.list({
      scriptId,
    });
    if (deploymentsList.status !== 200) {
      // logError(deploymentsList.statusText);
      throw new ExitAndLogError(1, getErrorDescription(deploymentsList.statusText));
    }

    const deployments = deploymentsList.data.deployments || [];
    if (deployments.length === 0) {
      // logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
      throw new ExitAndLogError(1, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }

    // @HEAD (Read-only deployments) may not be deleted.
    if (deployments.length <= 1) {
      // logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
      throw new ExitAndLogError(1, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }

    deploymentId = deployments[deployments.length - 1].deploymentId || '';
  }

  spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
  const response = await script.projects.deployments.delete({
    scriptId,
    deploymentId,
  });
  if (spinner.isSpinning()) spinner.stop(true);
  if (response.status === 200) {
    console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
  } else {
    // logError(null, ERROR.READ_ONLY_DELETE);
    throw new ExitAndLogError(1, ERROR.READ_ONLY_DELETE);
  }
};
