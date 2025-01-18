import {google, script_v1 as scriptV1} from 'googleapis';

import {OAuth2Client} from 'google-auth-library';
import {getAuthorizedOAuth2ClientOrDie} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils.js';

/**
 * Lists versions of an Apps Script project.
 */
export async function listVersionsCommand(): Promise<void> {
  await checkIfOnlineOrDie();
  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();
  const {scriptId} = await getProjectSettings();

  spinner.start('Grabbing versions…');

  const versionList = await getVersionList(oauth2Client, scriptId);

  stopSpinner();

  if (versionList.length === 0) {
    throw new ClaspError(LOG.DEPLOYMENT_DNE);
  }

  console.log(LOG.VERSION_NUM(versionList.length));
  versionList.reverse();
  versionList.forEach(version => console.log(LOG.VERSION_DESCRIPTION(version)));
}

async function getVersionList(oauth2Client: OAuth2Client, scriptId: string) {
  let maxPages = 5;
  let pageToken: string | undefined;
  const list: scriptV1.Schema$Version[] = [];

  const script = google.script({version: 'v1', auth: oauth2Client});

  do {
    const res = await script.projects.versions.list({
      scriptId,
      pageSize: 200,
      pageToken,
    });
    if (res.data.versions) {
      list.push(...res.data.versions);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && --maxPages);

  return list;
}
