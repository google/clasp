import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {INCLUDE_USER_HINT_IN_URL} from '../experiments.js';
import {intl} from '../intl.js';
import {openUrl} from './utils.js';

export const command = new Command('open-container')
  .description('Open the Apps Script IDE for the current project.')
  .action(async function (this: Command): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const parentId = clasp.project.parentId;
    if (!parentId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Parent ID not set, unable to open document.',
      });
      this.error(msg);
    }

    const url = new URL('https://drive.google.com/open');
    url.searchParams.set('id', parentId);
    if (INCLUDE_USER_HINT_IN_URL) {
      const userHint = await clasp.authorizedUser();
      url.searchParams.set('authUser', userHint ?? '');
    }
    await openUrl(url.toString());
  });
