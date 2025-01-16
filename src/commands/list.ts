import {google} from 'googleapis';
import {getAuthorizedOAuth2Client} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {ERROR, LOG} from '../messages.js';
import {URL} from '../urls.js';
import {ellipsize, spinner, stopSpinner} from '../utils.js';

interface CommandOption {
  readonly noShorten: boolean;
}

/**
 * Lists a user's Apps Script projects using Google Drive.
 * @param options.noShorten {boolean}
 */
export async function listProjectsCommand(options: CommandOption): Promise<void> {
  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS(false));
  }

  const drive = google.drive({version: 'v3', auth: oauth2Client});

  spinner.start(LOG.FINDING_SCRIPTS);

  const {
    data: {files = []},
    status,
  } = await drive.files.list({
    pageSize: 50,
    // Fields isn't currently supported
    // https://github.com/googleapis/google-api-nodejs-client/issues/1374
    // fields: 'nextPageToken, files(id, name)',
    q: 'mimeType="application/vnd.google-apps.script"',
  });

  if (status !== 200) {
    throw new ClaspError(ERROR.DRIVE);
  }

  stopSpinner();

  if (files.length > 0) {
    for (const file of files) {
      console.log(`${options.noShorten ? file.name! : ellipsize(file.name!, 20)} - ${URL.SCRIPT(file.id ?? '')}`);
    }
  } else {
    console.log(LOG.FINDING_SCRIPTS_DNE);
  }
}
