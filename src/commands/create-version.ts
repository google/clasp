import {Command} from 'commander';

import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

export const command = new Command('create-version')
  .alias('version')
  .arguments('[description]')
  .description('Creates an immutable version of the script')
  .action(async function (this: Command, description?: string): Promise<void> {
    const clasp: Clasp = this.opts().clasp;

    if (!description && isInteractive()) {
      const prompt = intl.formatMessage({
        defaultMessage: 'Give a description:',
      });
      const answer = await inquirer.prompt([
        {
          default: '',
          message: prompt,
          name: 'description',
          type: 'input',
        },
      ]);
      description = answer.description;
    }

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Creating a new version...',
    });
    const versionNumber = await withSpinner(spinnerMsg, async () => {
      return clasp.project.version(description);
    });

    const successMessage = intl.formatMessage(
      {
        defaultMessage: `Created version {version, number}`,
      },
      {
        version: versionNumber,
      },
    );
    console.log(successMessage);
  });
