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

    if (deploymentId) {
      await deleteDeployment(scriptId, deploymentId);
    } else {
      const deployments = await listDeployments(scriptId);

      // @HEAD (Read-only deployments) may not be deleted.
      deployments.shift();

      const lastDeployment = deployments.pop();
      if (!lastDeployment) {
        throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
      }

      await deleteDeployment(scriptId, lastDeployment.deploymentId as string);
    }
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

  const deployments = data.deployments ?? [];
  if (deployments.length === 0) {
    throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
  }
  return deployments;
};
