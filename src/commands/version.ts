import {google} from 'googleapis';
import inquirer from 'inquirer';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils.js';

/**
 * Creates a new version of an Apps Script project.
 */
export async function createVersionCommand(description?: string): Promise<void> {
  await checkIfOnlineOrDie();
  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();
  const {scriptId} = await getProjectSettings();

  const script = google.script({version: 'v1', auth: oauth2Client});

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
  const res = await script.projects.versions.create({scriptId, requestBody: {description}});
  stopSpinner();

  console.log(LOG.VERSION_CREATED(res.data.versionNumber ?? -1));
}
