import open from 'open';
import { loadAPICredentials, script } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { deploymentIdPrompt } from '../inquirer.js';
import { ERROR, LOG } from '../messages.js';
import { URL } from '../urls.js';
import { ellipsize, getProjectSettings, getWebApplicationURL } from '../utils.js';
const getDeploymentId = async (choices) => {
    const { deployment: { deploymentId }, } = await deploymentIdPrompt(choices);
    return deploymentId;
};
/**
 * Opens an Apps Script project's script.google.com editor.
 * @param scriptId {string} The Apps Script project to open.
 * @param options.webapp {boolean} If true, the command will open the webapps URL.
 * @param options.creds {boolean} If true, the command will open the credentials URL.
 * @param options.deploymentId {string} Use custom deployment ID with webapp.
 */
export default async (scriptId, options) => {
    const projectSettings = await getProjectSettings();
    const currentScriptId = scriptId !== null && scriptId !== void 0 ? scriptId : projectSettings.scriptId;
    if (currentScriptId.length < 30) {
        throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(currentScriptId));
    }
    // We've specified to open creds.
    if (options.creds) {
        const { projectId } = projectSettings;
        if (!projectId) {
            throw new ClaspError(ERROR.NO_GCLOUD_PROJECT());
        }
        console.log(LOG.OPEN_CREDS(projectId));
        await open(URL.CREDS(projectId));
        return;
    }
    // We've specified to print addons and open the first one.
    if (options.addon) {
        await openAddon(projectSettings);
        return;
    }
    if (options.webapp) {
        await openWebApp(currentScriptId, options.deploymentId);
        return;
    }
    // If we're not a web app, open the script URL.
    console.log(LOG.OPEN_PROJECT(currentScriptId));
    await open(URL.SCRIPT(currentScriptId));
};
const openAddon = async (projectSettings) => {
    const { parentId: parentIdList = [] } = projectSettings;
    if (parentIdList.length === 0) {
        throw new ClaspError(ERROR.NO_PARENT_ID());
    }
    if (parentIdList.length > 1) {
        for (const id of parentIdList) {
            console.log(LOG.FOUND_PARENT(id));
        }
    }
    const parentId = parentIdList[0];
    console.log(LOG.OPEN_FIRST_PARENT(parentId));
    await open(URL.DRIVE(parentId));
};
const openWebApp = async (scriptId, optionsDeploymentId) => {
    // Web app: open the latest deployment.
    await loadAPICredentials();
    const { data: { deployments = [] }, status, statusText, } = await script.projects.deployments.list({ scriptId });
    if (status !== 200) {
        throw new ClaspError(statusText);
    }
    if (deployments.length === 0) {
        throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }
    // Order deployments by update time.
    const choices = [...deployments];
    choices.sort((a, b) => (a.updateTime && b.updateTime ? a.updateTime.localeCompare(b.updateTime) : 0));
    const prompts = choices.map(value => {
        const { description, versionNumber } = value.deploymentConfig;
        const name = `${ellipsize(description !== null && description !== void 0 ? description : '', 30)}@${`${versionNumber !== null && versionNumber !== void 0 ? versionNumber : 'HEAD'}`.padEnd(4)} - ${value.deploymentId}`;
        return { name, value };
    });
    const deploymentId = optionsDeploymentId !== null && optionsDeploymentId !== void 0 ? optionsDeploymentId : (await getDeploymentId(prompts));
    const deployment = await script.projects.deployments.get({ scriptId, deploymentId });
    console.log(LOG.OPEN_WEBAPP(deploymentId));
    const target = getWebApplicationURL(deployment.data);
    if (!target) {
        throw new ClaspError(`Could not open deployment: ${JSON.stringify(deployment)}`);
    }
    await open(target, { wait: false });
};
//# sourceMappingURL=open.js.map