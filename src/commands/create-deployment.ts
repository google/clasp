import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, withSpinner} from './utils.js';

interface CommandOption {
  readonly versionNumber?: number;
  readonly description?: string;
  readonly deploymentId?: string;
}

export const command = new Command('create-deployment')
  .alias('deploy')
  .description('Deploy a project')
  .option('-V, --versionNumber <version>', 'The project version') // We can't use `version` in subcommand
  .option('-d, --description <description>', 'The deployment description')
  .option('-i, --deploymentId <id>', 'The deployment ID to redeploy')
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    await checkIfOnlineOrDie();

    const clasp: Clasp = this.opts().clasp;
    const deploymentId = options.deploymentId;
    const description = options.description;
    const versionNumber = options.versionNumber;

    try {
      const deployment = await withSpinner('Deploying project...', async () => {
        return await clasp.project.deploy(description, deploymentId, versionNumber);
      });
      console.log(`- ${deployment.deploymentId} @${deployment.deploymentConfig?.versionNumber}.`);
    } catch (error) {
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        this.error(error.cause.message);
      }
      throw error;
    }
  });
