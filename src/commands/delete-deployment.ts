import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, withSpinner} from './utils.js';
interface CommandOption {
  readonly all?: boolean;
}

export const command = new Command('delete-deployment')
  .alias('undeploy')
  .description('Delete a deployment of a project')
  .arguments('[deploymentId]')
  .option('-a, --all', 'Undeploy all deployments')
  .action(async function (this: Command, deploymentId: string | undefined, options: CommandOption) {
    await checkIfOnlineOrDie();

    const clasp: Clasp = this.opts().clasp;

    const removeAll = options.all;

    if (removeAll) {
      const deployments = await withSpinner('Fetching deployments...', async () => {
        return await clasp.project.listDeployments();
      });

      deployments.results.shift(); // @HEAD (Read-only deployments) may not be deleted.
      for (const deployment of deployments.results) {
        const id = deployment.deploymentId;
        if (!id) {
          continue;
        }
        await withSpinner(`Deleting deployment ${id}`, async () => {
          await clasp.project.undeploy(id);
        });
      }
      console.log(LOG.UNDEPLOYMENT_ALL_FINISH);
      return;
    }

    if (!deploymentId) {
      const deployments = await clasp.project.listDeployments();
      // @HEAD (Read-only deployments) may not be deleted.
      deployments.results.shift();

      const lastDeployment = deployments.results.pop();
      if (!lastDeployment || !lastDeployment.deploymentId) {
        this.error('No deployments found.');
      }
      deploymentId = lastDeployment.deploymentId;
    }

    await withSpinner(`Deleting deployment ${deploymentId}`, async () => {
      await clasp.project.undeploy(deploymentId);
    });
  });
