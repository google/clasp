import {Command} from 'commander';

import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

interface CommandOption {
  readonly json?: boolean;
}

export const command = new Command('show-file-status')
  .alias('status')
  .description('Lists files that will be pushed by clasp')
  .option('--json', 'Show status in JSON form')
  .action(async function (this: Command, options?: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const outputAsJson = options?.json ?? false;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Analyzing project files...',
    });
    const [filesToPush, untrackedFiles] = await withSpinner(spinnerMsg, async () => {
      return await Promise.all([clasp.files.collectLocalFiles(), clasp.files.getUntrackedFiles()]);
    });

    if (outputAsJson) {
      const json = JSON.stringify({
        filesToPush: filesToPush.map(f => f.localPath),
        untrackedFiles,
      });
      console.log(json);
      return;
    }

    const trackedMsg = intl.formatMessage({
      defaultMessage: 'Tracked files:',
    });
    console.log(trackedMsg);
    for (const file of filesToPush) {
      console.log(`└─ ${file.localPath}`);
    }
    const untrackedMsg = intl.formatMessage({
      defaultMessage: 'Untracked files:',
    });
    console.log(untrackedMsg);
    for (const file of untrackedFiles) {
      console.log(`└─ ${file}`);
    }
  });
