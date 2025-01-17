import path from 'node:path';
import {google} from 'googleapis';
import inflection from 'inflection';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {ClaspError} from '../clasp-error.js';
import {Conf} from '../conf.js';
import {fetchProject, hasProject, writeProjectFiles} from '../files.js';
import {manifestExists} from '../manifest.js';
import {ERROR, LOG} from '../messages.js';
import {checkIfOnlineOrDie, saveProject, spinner, stopSpinner} from '../utils.js';

// https://developers.google.com/drive/api/v3/mime-types
const DRIVE_FILE_MIMETYPES: Record<string, string> = {
  docs: 'application/vnd.google-apps.document',
  forms: 'application/vnd.google-apps.form',
  sheets: 'application/vnd.google-apps.spreadsheet',
  slides: 'application/vnd.google-apps.presentation',
};

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

  if (hasProject()) {
    throw new ClaspError(ERROR.FOLDER_EXISTS());
  }

  await checkIfOnlineOrDie();

  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();

  // Create defaults.
  let parentId: string | undefined = options.parentId;
  const name: string | undefined = getDefaultProjectName(config);
  const type: string = options.type ?? '';

  if (!parentId && DRIVE_FILE_MIMETYPES[type]) {
    // Create files with MIME type.
    const mimeType = DRIVE_FILE_MIMETYPES[type];
    spinner.start(LOG.CREATE_DRIVE_FILE_START(type));
    const drive = google.drive({version: 'v3', auth: oauth2Client});
    const res = await drive.files.create({requestBody: {mimeType, name}});
    if (!res.data.id) {
      throw new ClaspError('An unexpected error occurred while creating the file.');
    }

    parentId = res.data.id;
    stopSpinner();
    console.log(LOG.CREATE_DRIVE_FILE_FINISH(type, parentId));
  }

  // CLI Spinner
  spinner.start(LOG.CREATE_PROJECT_START(name));

  // Create a new Apps Script project
  const script = google.script({version: 'v1', auth: oauth2Client});
  const {data, status, statusText} = await script.projects.create({
    requestBody: {
      parentId,
      title: name,
    },
  });

  stopSpinner();

  if (status !== 200) {
    if (parentId) {
      console.log(statusText, ERROR.CREATE_WITH_PARENT);
    }

    throw new ClaspError(statusText ?? ERROR.CREATE);
  }

  const scriptId = data.scriptId ?? '';
  console.log(LOG.CREATE_PROJECT_FINISH(type, scriptId));

  await saveProject(
    {
      scriptId,
      rootDir: config.projectRootDirectory,
      parentId: parentId ? [parentId] : undefined,
    },
    false,
  );

  if (!manifestExists(config.projectRootDirectory)) {
    await writeProjectFiles(await fetchProject(oauth2Client, scriptId), config.projectRootDirectory); // Fetches appsscript.json, o.w. `push` breaks
  }
}

/**
 * Gets default project name.
 * @return {string} default project name.
 */
function getDefaultProjectName(config: Conf) {
  const dirName = path.basename(config.projectRootDirectory!);
  return inflection.humanize(dirName);
}
