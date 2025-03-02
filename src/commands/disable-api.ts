import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, checkIfOnlineOrDie, maybePromptForProjectId, withSpinner} from './utils.js';

export const command = new Command('disable-api')
  .description('Disable a service for the current project.')
  .argument('<api>', 'Service to disable')
  .action(async function (this: Command, serviceName: string) {
    const clasp: Clasp = this.opts().clasp;

    await checkIfOnlineOrDie();

    await maybePromptForProjectId(clasp);

    assertGcpProjectConfigured(clasp);

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Disabling service...',
    });
    await withSpinner(spinnerMsg, async () => {
      await clasp.services.disableService(serviceName);
    });

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Disabled {name} API.',
      },
      {
        name: serviceName,
      },
    );
    console.log(successMessage);
  });
