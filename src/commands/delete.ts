import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {isInteractive, withSpinner} from './utils.js';

interface CommandOption {
  readonly force?: boolean;
}

export const command = new Command('delete')
  .description('Delete a project')
  .option(
    '-f, --force',
    'Bypass any confirmation messages. It’s not a good idea to do this unless you want to run clasp from a script.',
  )
  .action(async function (this: Command, options: CommandOption) {
    const {force} = options;

    const clasp: Clasp = this.opts().clasp;

    const scriptId = clasp.project.scriptId;
    if (!scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Script ID not set, unable to delete the script.',
      });
      this.error(msg);
    }

    //ask confirmation
    if (!force && isInteractive()) {
      const promptDeleteDriveFiles = intl.formatMessage({
        defaultMessage: 'Are you sure you want to delete the script?',
      });
      const answerDeleteDriveFiles = await inquirer.prompt([
        {
          default: false,
          message: promptDeleteDriveFiles,
          name: 'answer',
          type: 'confirm',
        },
      ]);
      if (!answerDeleteDriveFiles.answer) {
        return;
      }
    }

    const spinnerMsg = intl.formatMessage({
      defaultMessage: 'Deleting your scripts...',
    });
    await withSpinner(spinnerMsg, async () => await clasp.project.trashScript(scriptId));

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Deleted script {scriptId}',
      },
      {scriptId},
    );
    console.log(successMessage);
  });
