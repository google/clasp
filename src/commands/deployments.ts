import {Command} from 'commander';
import {google} from 'googleapis';

import {Context, assertAuthenticated, assertScriptSettings} from '../context.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, spinner, stopSpinner} from '../utils.js';

/**
 * Lists a script's deployments.
 */
export async function listDeploymentsCommand(this: Command): Promise<void> {
  await checkIfOnlineOrDie();

  const context: Context = this.opts().context;
  assertAuthenticated(context);
  assertScriptSettings(context);

  const script = google.script({version: 'v1', auth: context.credentials});

  spinner.start(LOG.DEPLOYMENT_LIST(context.project.settings.scriptId));

  const res = await script.projects.deployments.list({
    scriptId: context.project.settings.scriptId,
  });
  stopSpinner();

  const deployments = res.data.deployments ?? [];

  if (!deployments.length) {
    console.log('No deployments.');
    return;
  }

  console.log(`${deployments.length} ${deployments.length === 1 ? 'Deployment' : 'Deployments'}.`);
  deployments
    .filter(d => d.deploymentConfig && d.deploymentId)
    .forEach(d => {
      const versionString = d.deploymentConfig?.versionNumber ? `@${d.deploymentConfig.versionNumber}` : '@HEAD';
      const description = d.deploymentConfig?.description ? `- ${d.deploymentConfig.description}` : '';
      console.log(`- ${d.deploymentId} ${versionString} ${description}`);
    });
}
