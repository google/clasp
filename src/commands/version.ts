import { loadAPICredentials, script } from '../auth';
import { descriptionPrompt } from '../inquirer';
import { checkIfOnline, getProjectSettings, LOG, logError, spinner } from '../utils';

/**
 * Creates a new version of an Apps Script project.
 */
export default async (description: string): Promise<void> => {
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
  if (spinner.isSpinning()) spinner.stop(true);
  if (versions.status === 200) {
    console.log(LOG.VERSION_CREATED(versions.data.versionNumber || -1));
  } else {
    logError(versions.statusText);
  }
};
