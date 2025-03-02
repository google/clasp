import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {checkIfOnlineOrDie, openUrl} from './utils.js';

export const command = new Command('open-container')
  .description('Open the Apps Script IDE for the current project.')
  .action(async function (this: Command): Promise<void> {
    await checkIfOnlineOrDie();
    const clasp: Clasp = this.opts().clasp;

    const parentId = clasp.project.parentId;
    if (!parentId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Parent ID not set, unable to open document.',
      });
      this.error(msg);
    }

    const url = `https://drive.google.com/open?id=${parentId}`;
    await openUrl(url);
  });
