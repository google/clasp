import {Command} from 'commander';
import {google} from 'googleapis';

import inquirer from 'inquirer';
import {Context, assertAuthenticated, assertScriptSettings} from '../context.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, spinner, stopSpinner} from '../utils.js';

/**
 * Creates a new version of an Apps Script project.
 */
export async function createVersionCommand(this: Command, description?: string): Promise<void> {
  await checkIfOnlineOrDie();

  const context: Context = this.opts().context;
  assertAuthenticated(context);
  assertScriptSettings(context);

  const script = google.script({version: 'v1', auth: context.credentials});

  if (!description) {
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

  spinner.start(LOG.VERSION_CREATE);
  const res = await script.projects.versions.create({
    scriptId: context.project.settings.scriptId,
    requestBody: {
      description,
    },
  });
  stopSpinner();

  console.log(LOG.VERSION_CREATED(res.data.versionNumber ?? -1));
}
