import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {checkIfOnlineOrDie, openUrl} from './utils.js';

export const command = new Command('open-container')
  .description('Open the Apps Script IDE for the current project.')
  .action(async function (this: Command): Promise<void> {
    await checkIfOnlineOrDie();
    const clasp: Clasp = this.opts().clasp;

    const parentId = clasp.project.parentId;
    if (!parentId) {
      this.error('Parent ID not set. Unable to open document.');
    }

    const url = `https://drive.google.com/open?id=${parentId}`;
    console.log(`Opening ${url}`);
    await openUrl(url);
  });
