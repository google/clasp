import { loadAPICredentials, script } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { LOG } from '../messages.js';
import { getProjectSettings, spinner, stopSpinner } from '../utils.js';
/**
 * Lists a script's deployments.
 */
export default async () => {
    await loadAPICredentials();
    const { scriptId } = await getProjectSettings();
    if (scriptId) {
        spinner.start(LOG.DEPLOYMENT_LIST(scriptId));
        const { data: { deployments = [] }, status, statusText, } = await script.projects.deployments.list({ scriptId });
        stopSpinner();
        if (status !== 200) {
            throw new ClaspError(statusText);
        }
        const deploymentCount = deployments.length;
        console.log(`${deploymentCount} ${deploymentCount === 1 ? 'Deployment' : 'Deployments'}.`);
        for (const { deploymentId, deploymentConfig } of deployments) {
            if (deploymentId && deploymentConfig) {
                const versionString = deploymentConfig.versionNumber ? `@${deploymentConfig.versionNumber}` : '@HEAD';
                const description = deploymentConfig.description ? `- ${deploymentConfig.description}` : '';
                console.log(`- ${deploymentId} ${versionString} ${description}`);
            }
        }
    }
};
//# sourceMappingURL=deployments.js.map