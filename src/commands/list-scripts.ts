import {Command} from 'commander';
import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
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

    const files = await withSpinner(LOG.FINDING_SCRIPTS, async () => {
      return clasp.project.listScripts();
    });

    if (!files.results.length) {
      console.log(LOG.FINDING_SCRIPTS_DNE);
      return;
    }

    files.results.forEach(file => {
      const name = options.noShorten ? file.name! : ellipsize(file.name!, 20);
      const url = `https://script.google.com/d/${file.id}/edit`;
      console.log(`${name} - ${url}`);
    });
  });
