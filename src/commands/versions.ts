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
  const versionList = await getVersionList(scriptId);

  stopSpinner();

  const count = versionList.length;
  if (count === 0) {
    throw new ClaspError(LOG.DEPLOYMENT_DNE);
  }

  console.log(LOG.VERSION_NUM(count));
  versionList.reverse();
  versionList.forEach((version: Readonly<scriptV1.Schema$Version>) => {
    console.log(LOG.VERSION_DESCRIPTION(version));
  });
};

const getVersionList = async (scriptId: string) => {
  let maxPages = 5;
  let pageToken: string | null | undefined = undefined;
  let list: scriptV1.Schema$Version[] = [];

  do {
    const {data, status, statusText} = await script.projects.versions.list({scriptId, pageSize: 200, pageToken});
    if (status !== 200) {
      throw new ClaspError(statusText);
    }

    const {nextPageToken, versions} = data as scriptV1.Schema$ListVersionsResponse;
    if (versions) {
      list = [...list, ...(versions ?? [])];
      pageToken = nextPageToken;
    }
  } while (pageToken && --maxPages);

  return list;
};
