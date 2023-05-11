import pMap from 'p-map';
import { loadAPICredentials, script } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { ERROR, LOG } from '../messages.js';
import { getProjectSettings, spinner, stopSpinner } from '../utils.js';
/**
 * Removes a deployment from the Apps Script project.
 * @param deploymentId {string} The deployment's ID
 */
export default async (deploymentId, options) => {
    await loadAPICredentials();
    const { scriptId } = await getProjectSettings();
    if (scriptId) {
        if (options.all) {
            const mapper = async ({ deploymentId }) => deleteDeployment(scriptId, deploymentId);
            const deployments = await listDeployments(scriptId);
            deployments.shift(); // @HEAD (Read-only deployments) may not be deleted.
            await pMap(deployments, mapper);
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
            deploymentId = lastDeployment.deploymentId;
        }
        await deleteDeployment(scriptId, deploymentId);
    }
};
const deleteDeployment = async (scriptId, deploymentId) => {
    spinner.start(LOG.UNDEPLOYMENT_START(deploymentId));
    const { status } = await script.projects.deployments.delete({ scriptId, deploymentId });
    if (status !== 200) {
        throw new ClaspError(ERROR.READ_ONLY_DELETE);
    }
    stopSpinner();
    console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
};
const listDeployments = async (scriptId) => {
    const { data, status, statusText } = await script.projects.deployments.list({ scriptId });
    if (status !== 200) {
        throw new ClaspError(statusText);
    }
    const { deployments = [] } = data;
    if (deployments.length === 0) {
        throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }
    return deployments;
};
//# sourceMappingURL=undeploy.js.map