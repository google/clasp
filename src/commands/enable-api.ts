import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {assertGcpProjectConfigured, checkIfOnlineOrDie, maybePromptForProjectId, withSpinner} from './utils.js';

export const command = new Command('enable-api')
  .description('Enable a service for the current project.')
  .argument('<api>', 'Service to enable')
  .action(async function (this: Command, serviceName: string) {
    const clasp: Clasp = this.opts().clasp;

    await checkIfOnlineOrDie();

    await maybePromptForProjectId(clasp);
    assertGcpProjectConfigured(clasp);

    try {
      const spinnerMsg = intl.formatMessage({
        defaultMessage: 'Enabling service...',
      });
      await withSpinner(spinnerMsg, async () => {
        await clasp.services.enableService(serviceName);
      });
    } catch (error) {
      if (error.cause?.code === 'NOT_AUTHORIZED') {
        const msg = intl.formatMessage(
          {
            defaultMessage: 'Not authorized to enable {name} or it does not exist.',
          },
          {
            name: serviceName,
          },
        );
        this.error(msg);
      }
      throw error;
    }

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Enabled {name} API.',
      },
      {
        name: serviceName,
      },
    );
    console.log(successMessage);
  });
