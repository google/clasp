import {loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {descriptionPrompt} from '../inquirer';
import {LOG} from '../messages';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils';

/**
 * Creates a new version of an Apps Script project.
 */
export default async (description?: string): Promise<void> => {
  await checkIfOnlineOrDie();
  await loadAPICredentials();

  const {scriptId} = await getProjectSettings();
  description = description ?? (await descriptionPrompt()).description;

  spinner.setSpinnerTitle(LOG.VERSION_CREATE).start();

  const {data, status, statusText} = await script.projects.versions.create({scriptId, requestBody: {description}});
  if (status !== 200) {
    throw new ClaspError(statusText);
  }

  stopSpinner();
  console.log(LOG.VERSION_CREATED(data.versionNumber ?? -1));
};
