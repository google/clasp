import path from 'node:path';
import {Command} from 'commander';
import {google} from 'googleapis';
import inflection from 'inflection';
import {ClaspError} from '../clasp-error.js';
import {Context, assertAuthenticated} from '../context.js';
import {fetchProject, writeProjectFiles} from '../files.js';
import {ERROR, LOG} from '../messages.js';
import {checkIfOnlineOrDie, saveProject, spinner, stopSpinner} from '../utils.js';
import {initProjectFromCommandOptions} from './clone.js';

// https://developers.google.com/drive/api/v3/mime-types
const DRIVE_FILE_MIMETYPES: Record<string, string> = {
  docs: 'application/vnd.google-apps.document',
  forms: 'application/vnd.google-apps.form',
  sheets: 'application/vnd.google-apps.spreadsheet',
  slides: 'application/vnd.google-apps.presentation',
};

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
export async function createCommand(this: Command, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();

  const context: Context = this.opts().context;
  assertAuthenticated(context);

  if (context.project) {
    throw new ClaspError(ERROR.FOLDER_EXISTS(context.project.configFilePath));
  }

  // Create defaults.
  let parentId: string | undefined = options.parentId;
  const name: string | undefined = getDefaultProjectName(process.cwd());
  const type: string = options.type ?? '';

  if (!parentId && DRIVE_FILE_MIMETYPES[type]) {
    // Create files with MIME type.
    const mimeType = DRIVE_FILE_MIMETYPES[type];
    spinner.start(LOG.CREATE_DRIVE_FILE_START(type));
    const drive = google.drive({version: 'v3', auth: context.credentials});
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
  const script = google.script({version: 'v1', auth: context.credentials});
  const res = await script.projects.create({
    requestBody: {
      parentId,
      title: name,
    },
  });

  const scriptId = res.data.scriptId;
  if (!scriptId) {
    // TODO - Better error
    throw new ClaspError('Unable to create project');
  }

  const opts = this.optsWithGlobals();
  const project = initProjectFromCommandOptions(opts, scriptId);
  project.settings.parentId = parentId ? [parentId] : undefined;
  context.project = project;

  stopSpinner();

  console.log(LOG.CREATE_PROJECT_FINISH(type, scriptId));

  const projectFiles = await fetchProject(context.credentials, scriptId);
  await writeProjectFiles(projectFiles, context.project);
  await saveProject(context.project);
}

/**
 * Gets default project name.
 * @return {string} default project name.
 */
function getDefaultProjectName(dir: string) {
  const dirName = path.basename(dir);
  return inflection.humanize(dirName);
}
