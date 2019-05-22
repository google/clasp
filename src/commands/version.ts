import { loadAPICredentials, script } from './../auth';
import { LOG, checkIfOnline, getProjectSettings, logError, spinner } from './../utils';
import { descriptionPrompt } from '../inquirer';

/**
 * Creates a new version of an Apps Script project.
 */
export default async (description: string) => {
  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings();
  if (!description) {
    const answers = await descriptionPrompt();
    description = answers.description;
  }
  spinner.setSpinnerTitle(LOG.VERSION_CREATE).start();
  const versions = await script.projects.versions.create({
    scriptId,
    requestBody: {
      description,
    },
  });
  spinner.stop(true);
  if (versions.status !== 200) {
    return logError(versions.statusText);
  }
  console.log(LOG.VERSION_CREATED(versions.data.versionNumber || -1));
};
