import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {withSpinner} from './utils.js';

interface CommandOption {
  readonly versionNumber?: number;
}

export const command = new Command('pull')
  .description('Fetch a remote project')
  .option('--versionNumber <version>', 'The version number of the project to retrieve.')
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    const versionNumber = options.versionNumber;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Pulling files...',
    });
    const files = await withSpinner(spinnerMsg, async () => {
      return await clasp.files.pull(versionNumber);
    });

    files.forEach(f => console.log(`└─ ${f.localPath}`));
    const successMessage = intl.formatMessage(
      {
        defaultMessage: `Pulled {count, plural, 
        =0 {no files.}
        one {one file.}
        other {# files}}.`,
      },
      {
        count: files.length,
      },
    );
    console.log(successMessage);
  });
