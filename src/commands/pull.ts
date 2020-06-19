import {fetchProject, writeProjectFiles} from '../files';
import {LOG} from '../messages';
import {checkIfOnlineOrDie, getProjectSettings, spinner} from '../utils';

interface CommandOption {
  readonly versionNumber?: number;
}

/**
 * Force downloads all Apps Script project files into the local filesystem.
 * @param options.versionNumber {number} The version number of the project to retrieve.
 *                              If not provided, the project's HEAD version is returned.
 */
export default async (options: CommandOption): Promise<void> => {
  await checkIfOnlineOrDie();
  const {scriptId, rootDir} = await getProjectSettings();
  if (scriptId) {
    spinner.setSpinnerTitle(LOG.PULLING);
    const files = await fetchProject(scriptId, options.versionNumber);
    await writeProjectFiles(files, rootDir);
  }
};
