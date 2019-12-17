import open from 'open';
import { loadAPICredentials, script } from '../auth';
import { deploymentIdPrompt } from '../inquirer';
import { URL } from '../urls';
import { ERROR, LOG, getProjectSettings, getWebApplicationURL, logError } from '../utils';

interface EllipizeOptions {
  ellipse?: string;
  chars?: string[];
  truncate?: boolean | 'middle';
}
const ellipsize: (str?: string, max?: number, opts?: EllipizeOptions) => string = require('ellipsize');

/**
 * Opens an Apps Script project's script.google.com editor.
 * @param scriptId {string} The Apps Script project to open.
 * @param cmd.webapp {boolean} If true, the command will open the webapps URL.
 * @param cmd.creds {boolean} If true, the command will open the credentials URL.
 */
export default async (
  scriptId: string,
  cmd: {
    webapp: boolean;
    creds: boolean;
  },
) => {
  const projectSettings = await getProjectSettings();
  if (!scriptId) scriptId = projectSettings.scriptId;
  if (scriptId.length < 30) logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
  // We've specified to open creds.
  if (cmd.creds) {
    const projectId = projectSettings.projectId;
    if (projectId) {
      console.log(LOG.OPEN_CREDS(projectId));
      return /*await*/ open(URL.CREDS(projectId), { wait: false });
    }
    logError(null, ERROR.NO_GCLOUD_PROJECT);
  }

  // If we're not a web app, open the script URL.
  if (!cmd.webapp) {
    console.log(LOG.OPEN_PROJECT(scriptId));
    return /*await*/ open(URL.SCRIPT(scriptId), { wait: false });
  }

  // Web app: Otherwise, open the latest deployment.
  await loadAPICredentials();
  const deploymentsList = await script.projects.deployments.list({ scriptId });
  if (deploymentsList.status !== 200) logError(deploymentsList.statusText);
  const deployments = deploymentsList.data.deployments || [];
  if (deployments.length === 0) logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
  // Order deployments by update time.
  const choices = deployments
    .slice()
    .sort((d1, d2) => {
      if (d1.updateTime && d2.updateTime) {
        return d1.updateTime.localeCompare(d2.updateTime);
      }
      return 0; // should never happen
    })
    .map(e => {
      const DESC_PAD_SIZE = 30;
      const config = e.deploymentConfig;
      const version = config && config.versionNumber;
      return {
        name:
          ellipsize(config && config.description!, DESC_PAD_SIZE).padEnd(DESC_PAD_SIZE) +
          `@${(typeof version === 'number' ? `${version}` : 'HEAD').padEnd(4)} - ${e.deploymentId}`,
        value: e,
      };
    });

  const answers = await deploymentIdPrompt(choices);
  const deployment = await script.projects.deployments.get({
    scriptId,
    deploymentId: answers.deployment.deploymentId!,
  });
  console.log(LOG.OPEN_WEBAPP(answers.deployment.deploymentId!));
  const target = getWebApplicationURL(deployment.data);
  if (target) {
    return /*await*/ open(target, { wait: false });
  } else {
    logError(null, `Could not open deployment: ${deployment}`);
  }
};
