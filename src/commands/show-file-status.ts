import {Command} from 'commander';

import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
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

    const [filesToPush, untrackedFiles] = await withSpinner('Analyzing project files...', async () => {
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

    console.log(LOG.STATUS_PUSH);
    for (const file of filesToPush) {
      console.log(`└─ ${file.localPath}`);
    }
    console.log('\n');
    console.log(LOG.STATUS_IGNORE);
    for (const file of untrackedFiles) {
      console.log(`└─ ${file}`);
    }
  });
