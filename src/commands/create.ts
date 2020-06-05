import {SCRIPT_TYPES} from '../apis';
import {drive, loadAPICredentials, script} from '../auth';
import {ClaspError} from '../clasp-error';
import {fetchProject, hasProject, writeProjectFiles} from '../files';
import {scriptTypePrompt} from '../inquirer';
import {manifestExists} from '../manifest';
import {ERROR, LOG} from '../messages';
import {checkIfOnline, getDefaultProjectName, getProjectSettings, saveProject, spinner} from '../utils';

interface CommandOption {
  readonly type?: string;
  readonly title?: string;
  readonly parentId?: string;
  readonly rootDir?: string;
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
  await checkIfOnline();
  if (hasProject()) throw new ClaspError(ERROR.FOLDER_EXISTS);
  await loadAPICredentials();

  // Create defaults.
  const title = options.title ?? getDefaultProjectName();
  let {parentId, type} = options as Required<CommandOption>;

  if (!parentId && !type) {
    const answers = await scriptTypePrompt();
    type = answers.type;
  }

  // Create files with MIME type.
  // https://developers.google.com/drive/api/v3/mime-types
  const DRIVE_FILE_MIMETYPES: {[key: string]: string} = {
    [SCRIPT_TYPES.DOCS]: 'application/vnd.google-apps.document',
    [SCRIPT_TYPES.FORMS]: 'application/vnd.google-apps.form',
    [SCRIPT_TYPES.SHEETS]: 'application/vnd.google-apps.spreadsheet',
    [SCRIPT_TYPES.SLIDES]: 'application/vnd.google-apps.presentation',
  };
  const driveFileType = DRIVE_FILE_MIMETYPES[type];
  if (driveFileType) {
    spinner.setSpinnerTitle(LOG.CREATE_DRIVE_FILE_START(type)).start();
    const driveFile = await drive.files.create({
      requestBody: {
        mimeType: driveFileType,
        name: title,
      },
    });
    parentId = driveFile.data.id ?? '';
    if (spinner.isSpinning()) spinner.stop(true);
    console.log(LOG.CREATE_DRIVE_FILE_FINISH(type, parentId));
  }

  // CLI Spinner
  spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title)).start();
  const {scriptId} = await getProjectSettings(true);
  if (scriptId) throw new ClaspError(ERROR.NO_NESTED_PROJECTS);

  // Create a new Apps Script project
  const response = await script.projects.create({
    requestBody: {
      title,
      parentId,
    },
  });
  if (spinner.isSpinning()) spinner.stop(true);
  if (response.status !== 200) {
    if (parentId) console.log(response.statusText, ERROR.CREATE_WITH_PARENT);
    throw new ClaspError(response.statusText ?? ERROR.CREATE);
  }

  const createdScriptId = response.data.scriptId ?? '';
  console.log(LOG.CREATE_PROJECT_FINISH(type, createdScriptId));
  const {rootDir} = options;
  await saveProject(
    {
      scriptId: createdScriptId,
      rootDir,
      parentId: [parentId],
    },
    false
  );
  if (!manifestExists(rootDir)) {
    const files = await fetchProject(createdScriptId); // Fetches appsscript.json, o.w. `push` breaks
    await writeProjectFiles(files, rootDir); // Fetches appsscript.json, o.w. `push` breaks
  }
};
