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
  const versions = await script.projects.versions.list({
    scriptId,
    pageSize: 500,
  });
  if (spinner.isSpinning()) spinner.stop(true);
  if (versions.status === 200) {
    const { data } = versions;
    if (data && data.versions && data.versions.length > 0) {
      const numVersions = data.versions.length;
      console.log(LOG.VERSION_NUM(numVersions));
      data.versions.reverse();
      data.versions.forEach((version: script_v1.Schema$Version) => {
        console.log(LOG.VERSION_DESCRIPTION(version));
      });
    } else {
      logError(null, LOG.DEPLOYMENT_DNE);
    }
  } else {
    logError(versions.statusText);
  }
};
