import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {checkIfOnlineOrDie, ellipsize, withSpinner} from './utils.js';

interface CommandOption {
  readonly noShorten: boolean;
}

export const command = new Command('list-scripts')
  .alias('list')
  .description('List App Scripts projects')
  .option('--noShorten', 'Do not shorten long names', false)
  .action(async function (this: Command, options: CommandOption): Promise<void> {
    await checkIfOnlineOrDie();

    const clasp: Clasp = this.opts().clasp;

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Finding your scripts...',
    });
    const files = await withSpinner(spinnerMsg, async () => {
      return clasp.project.listScripts();
    });

    if (!files.results.length) {
      const msg = intl.formatMessage({
        defaultMessage: 'No script files found.',
      });
      console.log(msg);
      return;
    }
    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Found {count, plural, one {# script} other {# scripts}}.',
      },
      {
        count: files.results.length,
      },
    );
    console.log(successMessage);
    files.results.forEach(file => {
      const name = options.noShorten ? file.name! : ellipsize(file.name!, 20);
      const url = `https://script.google.com/d/${file.id}/edit`;
      console.log(`${name} - ${url}`);
    });
  });
