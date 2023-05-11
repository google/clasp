import { loadAPICredentials, script } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { PROJECT_MANIFEST_BASENAME as manifestFileName } from '../constants.js';
import { ERROR, LOG } from '../messages.js';
import { getProjectSettings, spinner, stopSpinner } from '../utils.js';
/**
 * Deploys an Apps Script project.
 * @param options.versionNumber {string} The project version to deploy at.
 * @param options.description   {string} The deployment description.
 * @param options.deploymentId  {string} The deployment ID to redeploy.
 */
export default async (options) => {
    await loadAPICredentials();
    const { scriptId } = await getProjectSettings();
    if (!scriptId) {
        return;
    }
    spinner.start(LOG.DEPLOYMENT_START(scriptId));
    let { versionNumber } = options;
    const { deploymentId, description = '' } = options;
    // If no version, create a new version
    if (!versionNumber) {
        const { data: { versionNumber: newVersionNumber }, status, } = await script.projects.versions.create({ requestBody: { description }, scriptId });
        if (status !== 200) {
            throw new ClaspError(ERROR.ONE_DEPLOYMENT_CREATE);
        }
        stopSpinner();
        versionNumber = newVersionNumber !== null && newVersionNumber !== void 0 ? newVersionNumber : 0;
        console.log(LOG.VERSION_CREATED(versionNumber));
    }
    spinner.start(LOG.DEPLOYMENT_CREATE);
    const deploymentConfig = { description, manifestFileName, versionNumber };
    // If no deploymentId, create a new deployment
    // Else, update deployment
    const { data: { deploymentId: newDeploymentId }, status, } = deploymentId
        ? await script.projects.deployments.update({
            scriptId,
            deploymentId,
            requestBody: { deploymentConfig },
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
//# sourceMappingURL=deploy.js.map