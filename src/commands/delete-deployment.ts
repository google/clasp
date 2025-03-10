import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

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
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Deleting deployment...',
      });
      await withSpinner(spinnerMsg, async () => {
        return await clasp.project.undeploy(id);
      });
      const successMessage = intl.formatMessage(
        {
          defaultMessage: 'Deleted deployment {id}',
        },
        {id},
      );
      console.log(successMessage);
    };

    if (removeAll) {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Fetching deployments...',
      });
      const deployments = await withSpinner(spinnerMsg, async () => {
        return await clasp.project.listDeployments();
      });

      deployments.results = deployments.results.filter(
        deployment => deployment.deploymentConfig?.versionNumber !== undefined,
      );
      for (const deployment of deployments.results) {
        const id = deployment.deploymentId;
        if (!id) {
          continue;
        }
        await deleteDeployment(id);
      }
      const successMessage = intl.formatMessage({
        defaultMessage: `Deleted all deployments.`,
      });
      console.log(successMessage);
      return;
    }

    if (!deploymentId) {
      const deployments = await clasp.project.listDeployments();
      deployments.results = deployments.results.filter(
        deployment => deployment.deploymentConfig?.versionNumber !== undefined,
      );

      if (deployments.results.length === 1) {
        deploymentId = deployments.results[0].deploymentId ?? undefined;
      } else if (isInteractive()) {
        const prompt = intl.formatMessage({
          defaultMessage: 'Delete which deployment?',
        });
        const choices = deployments.results.map(deployment => ({
          name: `${deployment.deploymentId} - ${deployment.deploymentConfig?.description ?? ''}`,
          value: deployment.deploymentId,
        }));
        const answer = await inquirer.prompt([
          {
            choices: choices,
            message: prompt,
            name: 'deploymentId',
            pageSize: 30,
            type: 'list',
          },
        ]);
        deploymentId = answer.deploymentId;
      }
    }

    if (!deploymentId) {
      const msg = intl.formatMessage({
        defaultMessage: `No deployments found.`,
      });
      this.error(msg);
    }

    await deleteDeployment(deploymentId);
  });
