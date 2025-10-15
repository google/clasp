import {Command} from 'commander';
import inquirer from 'inquirer';
import {Clasp} from '../core/clasp.js';
import {intl} from '../intl.js';
import {GlobalOptions, isInteractive, withSpinner} from './utils.js';

interface CommandOptions extends GlobalOptions {
  readonly force?: boolean;
}

export const command = new Command('delete-script')
  .alias('delete')
  .description('Delete a project')
  .argument('[scriptId]', 'Apps Script ID to list deployments for')
  .option(
    '-f, --force',
    'Bypass any confirmation messages. It\'s not a good idea to do this unless you want to run clasp from a script.',
  )
  .action(async function (this: Command, scriptId?: string) {
    const options: CommandOptions = this.optsWithGlobals();
    const clasp: Clasp = options.clasp;
    if (scriptId) {
      clasp.withScriptId(scriptId);
    }

    if (!clasp.project.scriptId) {
      const msg = intl.formatMessage({
        defaultMessage: 'Script ID not set, unable to delete the script.',
      });
      this.error(msg);
    }

    //ask confirmation
    if (!options.force && isInteractive()) {
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
    await withSpinner(spinnerMsg, async () => await clasp.project.trashScript());

    const successMessage = intl.formatMessage(
      {
        defaultMessage: 'Deleted script {scriptId}',
      },
      {scriptId: clasp.project.scriptId},
    );
    console.log(successMessage);
  });
