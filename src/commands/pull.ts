import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {fetchProject, writeProjectFiles} from '../files.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, getProjectSettings, spinner, stopSpinner} from '../utils.js';

interface CommandOption {
  readonly versionNumber?: number;
}

/**
 * Force downloads all Apps Script project files into the local filesystem.
 * @param options.versionNumber {number} The version number of the project to retrieve.
 *                              If not provided, the project's HEAD version is returned.
 */
export async function pullFilesCommand(options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();
  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();

  const {scriptId, rootDir} = await getProjectSettings();
  if (scriptId) {
    spinner.start(LOG.PULLING);

    const files = await fetchProject(oauth2Client, scriptId, options.versionNumber);
    await writeProjectFiles(files, rootDir);

    stopSpinner();
  }
}
