import {script_v1 as scriptV1} from 'googleapis';

import {loadAPICredentials, script} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {LOG} from '../messages.js';
import {getProjectSettings, spinner, stopSpinner} from '../utils.js';

/**
 * Lists versions of an Apps Script project.
 */
export default async (): Promise<void> => {
  await loadAPICredentials();

  spinner.start('Grabbing versions…');

  const {scriptId} = await getProjectSettings();
  const versionList = await getVersionList(scriptId);

  stopSpinner();

  const count = versionList.length;
  if (count === 0) {
    throw new ClaspError(LOG.DEPLOYMENT_DNE);
  }

  console.log(LOG.VERSION_NUM(count));
  versionList.reverse();
  for (const version of versionList) {
    console.log(LOG.VERSION_DESCRIPTION(version));
  }
};

const getVersionList = async (scriptId: string) => {
  let maxPages = 5;
  let pageToken: string | undefined;
  let list: scriptV1.Schema$Version[] = [];

  do {
    const {data, status, statusText} = await script.projects.versions.list({scriptId, pageSize: 200, pageToken});
    if (status !== 200) {
      throw new ClaspError(statusText);
    }

    const {nextPageToken, versions} = data;
    if (versions) {
      list = [...list, ...(versions ?? [])];
      pageToken = nextPageToken ?? undefined;
    }
  } while (pageToken && --maxPages);

  return list;
};
