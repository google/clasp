import {google} from 'googleapis';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {LOG} from '../messages.js';
import {URL} from '../urls.js';
import {checkIfOnlineOrDie, ellipsize, spinner, stopSpinner} from '../utils.js';

interface CommandOption {
  readonly noShorten: boolean;
}

/**
 * Lists a user's Apps Script projects using Google Drive.
 * @param options.noShorten {boolean}
 */
export async function listProjectsCommand(options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();

  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();
  const drive = google.drive({version: 'v3', auth: oauth2Client});

  spinner.start(LOG.FINDING_SCRIPTS);

  const res = await drive.files.list({
    pageSize: 50,
    fields: 'nextPageToken, files(id, name)',
    q: 'mimeType="application/vnd.google-apps.script"',
  });

  stopSpinner();

  const files = res.data.files ?? [];

  if (!files.length) {
    console.log(LOG.FINDING_SCRIPTS_DNE);
    return;
  }

  files.forEach(file => {
    const name = options.noShorten ? file.name! : ellipsize(file.name!, 20);
    const url = URL.SCRIPT(file.id ?? '');
    console.log(`${name} - ${url}`);
  });
}
