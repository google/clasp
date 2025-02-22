import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, withSpinner} from './utils.js';

interface CommandOption {
  readonly versionNumber?: number;
}

export const command = new Command('pull')
  .description('Fetch a remote project')
  .option('--versionNumber <version>', 'The version number of the project to retrieve.')
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    await checkIfOnlineOrDie();

    const clasp: Clasp = this.opts().clasp;

    const versionNumber = options.versionNumber;

    const files = await withSpinner(LOG.PULLING, async () => {
      return await clasp.files.pull(versionNumber);
    });

    files.forEach(f => console.log(`└─ ${f.localPath}`));
    console.log(LOG.CLONE_SUCCESS(files.length));
  });
