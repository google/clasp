import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, maybePromptForProjectId, withSpinner} from './utils.js';

export const command = new Command('disable-api')
  .description('Disable a service for the current project.')
  .argument('<api>', 'Service to disable')
  .action(async function (this: Command, serviceName: string) {
    const clasp: Clasp = this.opts().clasp;

    await checkIfOnlineOrDie();

    const projectId = await maybePromptForProjectId(clasp);
    if (!projectId) {
      this.error('Project ID not set.');
    }

    await withSpinner('Disabling service...', async () => {
      await clasp.services.disableService(serviceName);
    });

    console.log(`Disabled ${serviceName} API.`);
  });
