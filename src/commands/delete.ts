import {driveV2, loadAPICredentials} from '../auth.js';
import {deleteClaspJsonPrompt, deleteDriveFilesPrompt} from '../inquirer.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, deleteProject, getProjectSettings, spinner, stopSpinner} from '../utils.js';

interface CommandOption {
  readonly force?: boolean;
}

/**
 * Delete an Apps Script project.
 * @param options.foce {boolean} force Bypass any confirmation messages.
 */
export default async (options: CommandOption): Promise<void> => {
  // Handle common errors.
  await checkIfOnlineOrDie();
  await loadAPICredentials();

  // Create defaults.
  const {force} = options;

  const projectSettings = await getProjectSettings();
  const parentIds = projectSettings.parentId || [];
  const hasParents = !!parentIds.length;

  //ask confirmation
  if (!force && !(await deleteDriveFilesPrompt(hasParents)).answer) {
    return;
  }

  //delete the drive files
  if (hasParents) {
    await deleteDriveFiles(parentIds);
  } else {
    await deleteDriveFiles([projectSettings.scriptId]);
  }

  // TODO: delete .clasp.json //
  if (force || (await deleteClaspJsonPrompt()).answer) {
    await deleteProject();
  }

  console.log(LOG.DELETE_DRIVE_FILE_FINISH);
};

/**
 * Delete Files on Drive.
 *
 * @param {string[]} fileIds the list of ids
 */
const deleteDriveFiles = async (fileIds: string[]): Promise<void> => {
  for (let i = 0; i < fileIds.length; i++) {
    const currId = fileIds[i];

    // CLI Spinner
    spinner.start(LOG.DELETE_DRIVE_FILE_START(currId));

    // Delete Apps Script project
    await driveV2.files.trash({fileId: currId});
  }

  stopSpinner();
};
