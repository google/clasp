import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

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
    const clasp: Clasp = this.opts().clasp;
    const deploymentId = options.deploymentId;
    const description = options.description;
    const versionNumber = options.versionNumber;

    try {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Deploying project...',
      });
      const deployment = await withSpinner(spinnerMsg, async () => {
        return await clasp.project.deploy(description, deploymentId, versionNumber);
      });
      const successMessage = intl.formatMessage(
        {
          defaultMessage: `Deployed {deploymentId} {version, select, 
          undefined {@HEAD}
          other {@{version}}
        }`,
        },
        {
          deploymentId: deployment.deploymentId,
          version: deployment.deploymentConfig?.versionNumber,
        },
      );
      console.log(successMessage);
    } catch (error) {
      if (error.cause?.code === 'INVALID_ARGUMENT') {
        this.error(error.cause.message);
      }
      throw error;
    }
  });
