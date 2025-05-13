import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {intl} from '../intl.js';
import {openUrl} from './utils.js';

export const command = new Command('open-script')
  .arguments('[scriptId]')
  .description('Open the Apps Script IDE for the current project.')
  .action(async function (this: Command, scriptId: string | undefined): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    if (!scriptId) {
      scriptId = clasp.project.scriptId;
    }
    if (!scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Script ID not set, unable to open IDE.',
      });
      this.error(msg);
    }

    const url = new URL(`https://script.google.com/d/${scriptId}/edit`);
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      url.searchParams.set('authUser', userHint ?? '');
    }
    await openUrl(url.toString());
  });
