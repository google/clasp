import {loadAPICredentials, script} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {descriptionPrompt} from '../inquirer.js';
import {LOG} from '../messages.js';
import {getProjectSettings, spinner, stopSpinner} from '../utils.js';

/**
 * Creates a new version of an Apps Script project.
 */
export default async (description?: string): Promise<void> => {
  await loadAPICredentials();

  const {scriptId} = await getProjectSettings();
  description = description ?? (await descriptionPrompt()).description;

  spinner.start(LOG.VERSION_CREATE);

  const {data, status, statusText} = await script.projects.versions.create({scriptId, requestBody: {description}});
  if (status !== 200) {
    throw new ClaspError(statusText);
  }

  stopSpinner();
  console.log(LOG.VERSION_CREATED(data.versionNumber ?? -1));
};
