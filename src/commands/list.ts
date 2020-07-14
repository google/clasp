import {drive, loadAPICredentials} from '../auth';
import {ClaspError} from '../clasp-error';
import {ERROR, LOG} from '../messages';
import {URL} from '../urls';
import {checkIfOnlineOrDie, ellipsize, spinner, stopSpinner} from '../utils';

/**
 * Lists a user's Apps Script projects using Google Drive.
 */
export default async (): Promise<void> => {
  await checkIfOnlineOrDie();
  await loadAPICredentials();

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
      console.log(`${ellipsize(file.name!, 20)} - ${URL.SCRIPT(file.id ?? '')}`);
    }
  } else {
    console.log(LOG.FINDING_SCRIPTS_DNE);
  }
};
