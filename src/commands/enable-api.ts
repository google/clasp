import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, maybePromptForProjectId, withSpinner} from './utils.js';

export const command = new Command('enable-api')
  .description('Enable a service for the current project.')
  .argument('<api>', 'Service to enable')
  .action(async function (this: Command, serviceName: string) {
    const clasp: Clasp = this.opts().clasp;

    await checkIfOnlineOrDie();

    const projectId = await maybePromptForProjectId(clasp);
    if (!projectId) {
      this.error('Project ID not set.');
    }

    try {
      await withSpinner('Enabling service...', async () => {
        await clasp.services.enableService(serviceName);
      });
    } catch (error) {
      if (error.cause?.code === 'NOT_AUTHORIZED') {
        this.error(`Not authorized to enable ${serviceName} or it does not exist.`);
      }
      throw error;
    }

    console.log(`Enabled ${serviceName} API.`);
  });
