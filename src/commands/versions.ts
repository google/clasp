import { script_v1 } from 'googleapis';
import {
  loadAPICredentials,
  script,
} from './../auth';
import {
  LOG,
  checkIfOnline,
  getProjectSettings,
  logError,
  spinner,
} from './../utils';

/**
 * Lists versions of an Apps Script project.
 */
export default async () => {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.setSpinnerTitle('Grabbing versions...').start();
  const { scriptId } = await getProjectSettings();
  const versions = await script.projects.versions.list({
    scriptId,
    pageSize: 500,
  });
  spinner.stop(true);
  if (versions.status !== 200) {
    return logError(versions.statusText);
  }
  const data = versions.data;
  if (!data || !data.versions || !data.versions.length) {
    return logError(null, LOG.DEPLOYMENT_DNE);
  }
  const numVersions = data.versions.length;
  console.log(LOG.VERSION_NUM(numVersions));
  data.versions.reverse().map((version: script_v1.Schema$Version) => {
    console.log(LOG.VERSION_DESCRIPTION(version));
  });
};