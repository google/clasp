import { script_v1 } from 'googleapis';

import { loadAPICredentials, script } from '../auth';
import { checkIfOnline, ExitAndLogError, getErrorDescription, getProjectSettings, LOG, spinner } from '../utils';

/**
 * Lists versions of an Apps Script project.
 */
export default async (): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.setSpinnerTitle('Grabbing versions...').start();
  const settings = await getProjectSettings();
  const scriptId = settings?.scriptId;
  const versions = await script.projects.versions.list({
    scriptId,
    pageSize: 500,
  });
  if (spinner.isSpinning()) spinner.stop(true);
  if (versions.status === 200) {
    const { data } = versions;
    if (data?.versions && data.versions.length > 0) {
      const numVersions = data.versions.length;
      console.log(LOG.VERSION_NUM(numVersions));
      data.versions.reverse();
      data.versions.forEach((version: script_v1.Schema$Version) => {
        console.log(LOG.VERSION_DESCRIPTION(version));
      });
    } else {
      // logError(null, LOG.DEPLOYMENT_DNE);
      throw new ExitAndLogError(1, LOG.DEPLOYMENT_DNE);
    }
  } else {
    // logError(versions.statusText);
    throw new ExitAndLogError(1, getErrorDescription(versions.statusText));
  }
};
