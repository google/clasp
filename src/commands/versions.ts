import {script_v1 as scriptV1} from 'googleapis';

import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {LOG} from '../messages';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils';

/**
 * Lists versions of an Apps Script project.
 */
export default async (): Promise<void> => {
  await checkIfOnlineOrDie();
  await loadAPICredentials();
  spinner.setSpinnerTitle('Grabbing versions…').start();
  const {scriptId} = await getProjectSettings();
  let maxPages = 5;
  /** @type {scriptV1.Schema$Version[] | undefined} */
  let versions = [] as scriptV1.Schema$Version[];
  let response;
  /** @type {string | null | undefined} */
  let pageToken;
  do {
    response = await script.projects.versions.list({
      scriptId,
      pageSize: 200,
      pageToken: pageToken ?? '',
    });
    if (response?.data) {
      versions = versions.concat(response.data.versions ?? []);
      pageToken = response.data.nextPageToken;
    }
  } while (pageToken && --maxPages);

  stopSpinner();
  if (response.status === 200) {
    if (versions.length > 0) {
      const versionCount = versions.length;
      console.log(LOG.VERSION_NUM(versionCount));
      versions.reverse();
      versions.forEach((version: Readonly<scriptV1.Schema$Version>) => {
        console.log(LOG.VERSION_DESCRIPTION(version));
      });
    } else {
      throw new ClaspError(LOG.DEPLOYMENT_DNE);
    }
  } else {
    throw new ClaspError(response.statusText);
  }
};
