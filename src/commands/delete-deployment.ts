import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

interface CommandOption {
  readonly all?: boolean;
}

export const command = new Command('delete-deployment')
  .alias('undeploy')
  .description('Delete a deployment of a project')
  .arguments('[deploymentId]')
  .option('-a, --all', 'Undeploy all deployments')
  .action(async function (this: Command, deploymentId: string | undefined, options: CommandOption) {
    const clasp: Clasp = this.opts().clasp;

    const removeAll = options.all;

    const deleteDeployment = async (id: string) => {
      const spinnerMsg = intl.formatMessage(
        {
          defaultMessage: 'Deleting deployment {id}',
        },
        {id},
      );
      return await withSpinner(spinnerMsg, async () => {
        return await clasp.project.undeploy(id);
      });
    };

    if (removeAll) {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Fetching deployments...',
      });
      const deployments = await withSpinner(spinnerMsg, async () => {
        return await clasp.project.listDeployments();
      });

      deployments.results.shift(); // @HEAD (Read-only deployments) may not be deleted.
      for (const deployment of deployments.results) {
        const id = deployment.deploymentId;
        if (!id) {
          continue;
        }
        await deleteDeployment(id);
      }
      const successMessage = intl.formatMessage({
        defaultMessage: `Undeployed all deployments.`,
      });
      console.log(successMessage);
      return;
    }

    if (!deploymentId) {
      const deployments = await clasp.project.listDeployments();
      // @HEAD (Read-only deployments) may not be deleted.
      deployments.results.shift();

      const lastDeployment = deployments.results.pop();
      if (!lastDeployment || !lastDeployment.deploymentId) {
        const msg = intl.formatMessage({
          defaultMessage: `No deployments found.`,
        });
        this.error(msg);
      }
      deploymentId = lastDeployment.deploymentId;
    }

    await deleteDeployment(deploymentId);
  });
