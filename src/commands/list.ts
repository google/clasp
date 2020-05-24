/* eslint-disable new-cap */
import {drive_v3 as driveV3} from 'googleapis';

import {drive, loadAPICredentials} from '../auth';
import {ClaspError} from '../clasp-error';
import {ERROR, LOG} from '../messages';
import {URL} from '../urls';
import {checkIfOnline, ellipsize, spinner} from '../utils';

/**
 * Lists a user's Apps Script projects using Google Drive.
 */
export default async (): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.setSpinnerTitle(LOG.FINDING_SCRIPTS).start();
  const filesList = await drive.files.list({
    pageSize: 50,
    // Fields isn't currently supported
    // https://github.com/googleapis/google-api-nodejs-client/issues/1374
    // fields: 'nextPageToken, files(id, name)',
    q: 'mimeType="application/vnd.google-apps.script"',
  });
  if (filesList.status !== 200) throw new ClaspError(ERROR.DRIVE);
  if (spinner.isSpinning()) spinner.stop(true);
  const files = filesList.data.files ?? [];
  if (files.length === 0) {
    console.log(LOG.FINDING_SCRIPTS_DNE);
    return;
  }

  files.forEach((file: Readonly<driveV3.Schema$File>) =>
    console.log(`${ellipsize(file.name!, 20)} – ${URL.SCRIPT(file.id ?? '')}`)
  );
};
