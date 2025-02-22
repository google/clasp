import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, openUrl} from './utils.js';

export const command = new Command('open-script')
  .arguments('[scriptId]')
  .description('Open the Apps Script IDE for the current project.')
  .action(async function (this: Command, scriptId: string | undefined): Promise<void> {
    await checkIfOnlineOrDie();
    const clasp: Clasp = this.opts().clasp;

    if (!scriptId) {
      scriptId = clasp.project.scriptId;
    }
    if (!scriptId) {
      this.error('Script ID not set. Unable to open IDE.');
    }

    const url = `https://script.google.com/d/${scriptId}/edit`;
    console.log(`Opening IDE: ${url}`);
    await openUrl(url);
  });
