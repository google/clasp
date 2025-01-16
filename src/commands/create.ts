import is from '@sindresorhus/is';
import {google} from 'googleapis';
import {SCRIPT_TYPES} from '../apis.js';
import {getAuthorizedOAuth2Client} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {Conf} from '../conf.js';
import {fetchProject, hasProject, writeProjectFiles} from '../files.js';
import {scriptTypePrompt} from '../inquirer.js';
import {manifestExists} from '../manifest.js';
import {ERROR, LOG} from '../messages.js';
import {getDefaultProjectName, getProjectSettings, saveProject, spinner, stopSpinner} from '../utils.js';

const config = Conf.get();

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
export async function createCommand(options: CommandOption): Promise<void> {
  if (options.rootDir) {
    config.projectRootDirectory = options.rootDir;
  }

  // Handle common errors.
  if (hasProject()) {
    throw new ClaspError(ERROR.FOLDER_EXISTS());
  }

  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS(false));
  }

  const drive = google.drive({version: 'v3', auth: oauth2Client});
  const script = google.script({version: 'v1', auth: oauth2Client});

  // Create defaults.
  const {parentId: optionParentId, title: name = getDefaultProjectName(), type: optionType} = options;
  let parentId = optionParentId;

  const filetype = optionType ?? (optionParentId ? '' : (await scriptTypePrompt()).type);

  // Create files with MIME type.
  // https://developers.google.com/drive/api/v3/mime-types
  const DRIVE_FILE_MIMETYPES: Record<string, string> = {
    [SCRIPT_TYPES.DOCS]: 'application/vnd.google-apps.document',
    [SCRIPT_TYPES.FORMS]: 'application/vnd.google-apps.form',
    [SCRIPT_TYPES.SHEETS]: 'application/vnd.google-apps.spreadsheet',
    [SCRIPT_TYPES.SLIDES]: 'application/vnd.google-apps.presentation',
  };
  const mimeType = DRIVE_FILE_MIMETYPES[filetype];
  if (mimeType) {
    spinner.start(LOG.CREATE_DRIVE_FILE_START(filetype));

    const {
      data: {id: newParentId},
    } = await drive.files.create({requestBody: {mimeType, name}});
    parentId = newParentId!;

    stopSpinner();

    console.log(LOG.CREATE_DRIVE_FILE_FINISH(filetype, parentId));
  }

  // CLI Spinner
  spinner.start(LOG.CREATE_PROJECT_START(name));

  let projectExist: boolean;
  try {
    projectExist = is.string((await getProjectSettings()).scriptId);
  } catch {
    process.exitCode = 0; // To reset `exitCode` that was overridden in ClaspError constructor.
    projectExist = false;
  }

  if (projectExist) {
    throw new ClaspError(ERROR.NO_NESTED_PROJECTS);
  }

  // Create a new Apps Script project
  const {data, status, statusText} = await script.projects.create({
    requestBody: {parentId, title: name},
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
  await saveProject(
    {scriptId, rootDir: config.projectRootDirectory, parentId: parentId ? [parentId] : undefined},
    false,
  );

  if (!manifestExists(config.projectRootDirectory)) {
    await writeProjectFiles(await fetchProject(scriptId), config.projectRootDirectory); // Fetches appsscript.json, o.w. `push` breaks
  }
}
