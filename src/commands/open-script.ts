import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
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

    const url = `https://script.google.com/d/${scriptId}/edit`;
    await openUrl(url);
  });
