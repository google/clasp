import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, withSpinner} from './utils.js';

export const command = new Command('list-deployments')
  .alias('deployments')
  .description('List deployment ids of a script')
  .action(async function (this: Command): Promise<void> {
    await checkIfOnlineOrDie();
    const clasp: Clasp = this.opts().clasp;

    const deployments = await withSpinner('Fetching deployments...', async () => {
      return await clasp.project.listDeployments();
    });

    if (!deployments.results.length) {
      console.log('No deployments.');
      return;
    }
    console.log(`${deployments.results.length} ${deployments.results.length === 1 ? 'Deployment' : 'Deployments'}.`);
    deployments.results
      .filter(d => d.deploymentConfig && d.deploymentId)
      .forEach(d => {
        const versionString = d.deploymentConfig?.versionNumber ? `@${d.deploymentConfig.versionNumber}` : '@HEAD';
        const description = d.deploymentConfig?.description ? `- ${d.deploymentConfig.description}` : '';
        console.log(`- ${d.deploymentId} ${versionString} ${description}`);
      });
  });
