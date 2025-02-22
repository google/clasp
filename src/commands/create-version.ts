import {Command} from 'commander';

import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, isInteractive, withSpinner} from './utils.js';

export const command = new Command('create-version')
  .alias('version')
  .arguments('[description]')
  .description('Creates an immutable version of the script')
  .action(async function (this: Command, description?: string): Promise<void> {
    await checkIfOnlineOrDie();

    const clasp: Clasp = this.opts().clasp;

    if (!description && isInteractive()) {
      const answer = await inquirer.prompt([
        {
          default: '',
          message: LOG.GIVE_DESCRIPTION,
          name: 'description',
          type: 'input',
        },
      ]);
      description = answer.description;
    }

    const versionNumber = await withSpinner('Creating a new version...', async () => {
      return clasp.project.version(description);
    });

    console.log(LOG.VERSION_CREATED(versionNumber));
  });
