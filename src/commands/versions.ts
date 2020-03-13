import { script_v1 } from 'googleapis';

import { loadAPICredentials, script } from '../auth';
import { checkIfOnline, getProjectSettings, LOG, logError, spinner } from '../utils';

/**
 * Lists versions of an Apps Script project.
 */
export default async (): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.setSpinnerTitle('Grabbing versions...').start();
  const { scriptId } = await getProjectSettings();
  let maxPages = 5;
  /** @type {script_v1.Schema$Version[] | undefined} */
  let versions = [] as script_v1.Schema$Version[];
  let res = undefined;
  /** @type {string | null | undefined} */
  let pageToken;
  do {
    res = await script.projects.versions.list({
      scriptId,
      pageSize: 200,
      pageToken: pageToken || ''
    });
    if (res && res.data) {
      versions = versions.concat(res.data.versions || []);
      pageToken = res.data.nextPageToken;
    }
  } while (pageToken && --maxPages);

  if (spinner.isSpinning()) spinner.stop(true);
  if (res.status === 200) {
    if (versions.length > 0) {
      const numVersions = versions.length;
      console.log(LOG.VERSION_NUM(numVersions));
      versions.reverse();
      versions.forEach((version: script_v1.Schema$Version) => {
        console.log(LOG.VERSION_DESCRIPTION(version));
      });
    } else {
      logError(null, LOG.DEPLOYMENT_DNE);
    }
  } else {
    logError(res.statusText);
  }
};
