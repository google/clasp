/* eslint-disable new-cap */
import {SCRIPT_TYPES} from '../apis';
import {drive, loadAPICredentials, script} from '../auth';
import {fetchProject, hasProject, writeProjectFiles} from '../files';
import {scriptTypePrompt} from '../inquirer';
import {manifestExists} from '../manifest';
import {ERROR, LOG} from '../messages';
import {checkIfOnline, getDefaultProjectName, getProjectSettings, logError, saveProject, spinner} from '../utils';

/**
 * Creates a new Apps Script project.
 * @param cmd.type {string} The type of the Apps Script project.
 * @param cmd.title {string} The title of the Apps Script project's file
 * @param cmd.parentId {string} The Drive ID of the G Suite doc this script is bound to.
 * @param cmd.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                    If not specified, clasp will default to the current directory.
 */
export default async (cmd: {type: string; title: string; parentId: string; rootDir: string}): Promise<void> => {
  // Handle common errors.
  await checkIfOnline();
  if (hasProject()) logError(null, ERROR.FOLDER_EXISTS);
  await loadAPICredentials();

  // Create defaults.
  const title = cmd.title || getDefaultProjectName();
  let {type} = cmd;
  let {parentId} = cmd;

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
  try {
    const {scriptId} = await getProjectSettings(true);
    if (scriptId) logError(null, ERROR.NO_NESTED_PROJECTS);
  } catch {
    // No scriptId (because project doesn't exist)
    // console.log(error);
  }

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
    logError(response.statusText, ERROR.CREATE);
  }

  const createdScriptId = response.data.scriptId ?? '';
  console.log(LOG.CREATE_PROJECT_FINISH(type, createdScriptId));
  const {rootDir} = cmd;
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
