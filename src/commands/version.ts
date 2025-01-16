import {google} from 'googleapis';
import {getAuthorizedOAuth2Client} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {descriptionPrompt} from '../inquirer.js';
import {ERROR, LOG} from '../messages.js';
import {getProjectSettings, spinner, stopSpinner} from '../utils.js';

/**
 * Creates a new version of an Apps Script project.
 */
export async function createVersionCommand(description?: string): Promise<void> {
  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS(false));
  }
  const script = google.script({version: 'v1', auth: oauth2Client});

  const {scriptId} = await getProjectSettings();
  description = description ?? (await descriptionPrompt()).description;

  spinner.start(LOG.VERSION_CREATE);

  const {data, status, statusText} = await script.projects.versions.create({scriptId, requestBody: {description}});
  if (status !== 200) {
    throw new ClaspError(statusText);
  }

  stopSpinner();
  console.log(LOG.VERSION_CREATED(data.versionNumber ?? -1));
}
