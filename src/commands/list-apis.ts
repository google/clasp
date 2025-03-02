import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, checkIfOnlineOrDie, maybePromptForProjectId, withSpinner} from './utils.js';

export const command = new Command('list-apis')
  .alias('apis')
  .description('List enabled APIs for the current project')
  .action(async function (this: Command) {
    const clasp: Clasp = this.opts().clasp;

    await checkIfOnlineOrDie();

    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Fetching APIs...',
    });
    const [enabledApis, availableApis] = await withSpinner(spinnerMsg, () =>
      Promise.all([clasp.services.getEnabledServices(), clasp.services.getAvailableServices()]),
    );

    const enabledApisLabel = intl.formatMessage({
      defaultMessage: '# Currently enabled APIs:',
    });
    console.log(`\n${enabledApisLabel}`);
    for (const service of enabledApis) {
      console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
    }

    const availableApisLabel = intl.formatMessage({
      defaultMessage: '# List of available APIs:',
    });
    console.log(`\n${availableApisLabel}`);
    for (const service of availableApis) {
      console.log(`${service.name.padEnd(25)} - ${service.description.padEnd(60)}`);
    }
  });
