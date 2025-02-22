import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, maybePromptForProjectId, withSpinner} from './utils.js';

export const command = new Command('list-apis')
  .alias('apis')
  .description('List enabled APIs for the current project')
  .action(async function (this: Command) {
    const clasp: Clasp = this.opts().clasp;

    await checkIfOnlineOrDie();

    const projectId = await maybePromptForProjectId(clasp);
    if (!projectId) {
      this.error('Project ID not set.');
    }

    const [enabledApis, availableApis] = await withSpinner('Fetching APIs...', () =>
      Promise.all([clasp.services.getEnabledServices(), clasp.services.getAvailableServices()]),
    );

    console.log('\n# Currently enabled APIs:');
    for (const service of enabledApis) {
      console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
    }

    console.log('\n# List of available APIs:');
    for (const service of availableApis) {
      console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
    }
  });
