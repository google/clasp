import { drive_v3 } from 'googleapis';
import { drive, loadAPICredentials } from '../auth';
import { URL } from '../urls';
import { ERROR, LOG, checkIfOnline, logError, spinner } from '../utils';

interface EllipizeOptions {
  ellipse?: string;
  chars?: string[];
  truncate?: boolean | 'middle';
}
const ellipsize: (str?: string, max?: number, opts?: EllipizeOptions) => string = require('ellipsize');

/**
 * Lists a user's Apps Script projects using Google Drive.
 */
export default async () => {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.setSpinnerTitle(LOG.FINDING_SCRIPTS).start();
  const filesList = await drive.files.list({
    pageSize: 50,
    // fields isn't currently supported
    // https://github.com/googleapis/google-api-nodejs-client/issues/1374
    // fields: 'nextPageToken, files(id, name)',
    q: 'mimeType="application/vnd.google-apps.script"',
  });
  spinner.stop(true);
  if (filesList.status !== 200) logError(null, ERROR.DRIVE);
  const files = filesList.data.files || [];
  if (!files.length) {
    return console.log(LOG.FINDING_SCRIPTS_DNE);
  }
  const NAME_PAD_SIZE = 20;
  files.forEach((file: drive_v3.Schema$File) => {
    const fileName = ellipsize(file.name, NAME_PAD_SIZE);
    console.log(`${fileName.padEnd(NAME_PAD_SIZE)} – ${URL.SCRIPT(file.id || '')}`);
  });
};
