import {SCRIPT_TYPES} from '../apis';
import {drive, loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {fetchProject, hasProject, writeProjectFiles} from '../files';
import {scriptTypePrompt} from '../inquirer';
import {manifestExists} from '../manifest';
import {ERROR, LOG} from '../messages';
import {
  checkIfOnlineOrDie,
  getDefaultProjectName,
  getProjectSettings,
  saveProject,
  spinner,
  stopSpinner,
} from '../utils';

interface CommandOption {
  readonly parentId?: string;
  readonly rootDir?: string;
  readonly title?: string;
  readonly type?: string;
}

/**
 * Creates a new Apps Script project.
 * @param options.type {string} The type of the Apps Script project.
 * @param options.title {string} The title of the Apps Script project's file
 * @param options.parentId {string} The Drive ID of the G Suite doc this script is bound to.
 * @param options.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                        If not specified, clasp will default to the current directory.
 */
export default async (options: CommandOption): Promise<void> => {
  // Handle common errors.
  await checkIfOnlineOrDie();
  if (hasProject()) {
    throw new ClaspError(ERROR.FOLDER_EXISTS);
  }

  await loadAPICredentials();

  // Create defaults.
  const {parentId: optionParentId, title: name = getDefaultProjectName(), type: optionType} = options;
  let parentId = optionParentId;

  const filetype = optionType ?? (!optionParentId ? (await scriptTypePrompt()).type : '');

  // Create files with MIME type.
  // https://developers.google.com/drive/api/v3/mime-types
  const DRIVE_FILE_MIMETYPES: {[key: string]: string} = {
    [SCRIPT_TYPES.DOCS]: 'application/vnd.google-apps.document',
    [SCRIPT_TYPES.FORMS]: 'application/vnd.google-apps.form',
    [SCRIPT_TYPES.SHEETS]: 'application/vnd.google-apps.spreadsheet',
    [SCRIPT_TYPES.SLIDES]: 'application/vnd.google-apps.presentation',
  };
  const mimeType = DRIVE_FILE_MIMETYPES[filetype];
  if (mimeType) {
    spinner.setSpinnerTitle(LOG.CREATE_DRIVE_FILE_START(filetype)).start();

    const {
      data: {id: newParentId},
    } = await drive.files.create({requestBody: {mimeType, name}});
    parentId = newParentId as string;

    stopSpinner();

    console.log(LOG.CREATE_DRIVE_FILE_FINISH(filetype, parentId as string));
  }

  // CLI Spinner
  spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(name)).start();

  if ((await getProjectSettings(true)).scriptId) {
    throw new ClaspError(ERROR.NO_NESTED_PROJECTS);
  }

  // Create a new Apps Script project
  const {data, status, statusText} = await script.projects.create({
    requestBody: {parentId: parentId, title: name},
  });

  stopSpinner();

  if (status !== 200) {
    if (parentId) {
      console.log(statusText, ERROR.CREATE_WITH_PARENT);
    }

    throw new ClaspError(statusText ?? ERROR.CREATE);
  }

  const scriptId = data.scriptId ?? '';
  console.log(LOG.CREATE_PROJECT_FINISH(filetype, scriptId));
  const {rootDir} = options;
  await saveProject({scriptId, rootDir, parentId: parentId ? [parentId] : undefined}, false);

  if (!manifestExists(rootDir)) {
    await writeProjectFiles(await fetchProject(scriptId), rootDir); // Fetches appsscript.json, o.w. `push` breaks
  }
};
