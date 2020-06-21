import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {ERROR, LOG} from '../messages';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils';

interface CommandOption {
  readonly all?: boolean;
}

/**
 * Removes a deployment from the Apps Script project.
 * @param deploymentId {string} The deployment's ID
 */
export default async (deploymentId: string | undefined, options: CommandOption): Promise<void> => {
  await checkIfOnlineOrDie();
  await loadAPICredentials();
  const {scriptId} = await getProjectSettings();
  if (scriptId) {
    if (options.all) {
      const deployments = await listDeployments(scriptId);

      deployments.shift(); // @HEAD (Read-only deployments) may not be deleted.
      for (const {deploymentId} of deployments) {
        await deleteDeployment(scriptId, deploymentId as string);
      }
      console.log(LOG.UNDEPLOYMENT_ALL_FINISH);
      return;
    }

    if (!deploymentId) {
      const deployments = await listDeployments(scriptId);

      // @HEAD (Read-only deployments) may not be deleted.
      deployments.shift();

      const lastDeployment = deployments.pop();
      if (!lastDeployment) {
        throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
      }

      deploymentId = lastDeployment.deploymentId as string;
    }

    await deleteDeployment(scriptId, deploymentId);
  }
};

const deleteDeployment = async (scriptId: string, deploymentId: string) => {
  spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();

  const {status} = await script.projects.deployments.delete({scriptId, deploymentId});
  if (status !== 200) {
    throw new ClaspError(ERROR.READ_ONLY_DELETE);
  }

  stopSpinner();
  console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
};

const listDeployments = async (scriptId: string) => {
  const {data, status, statusText} = await script.projects.deployments.list({scriptId});
  if (status !== 200) {
    throw new ClaspError(statusText);
  }

  const {deployments = []} = data;
  if (deployments.length === 0) {
    throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  }

  return deployments;
};
