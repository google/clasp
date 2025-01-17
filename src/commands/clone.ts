import {drive_v3 as driveV3, google} from 'googleapis';

import {OAuth2Client} from 'google-auth-library';
import inquirer from 'inquirer';
import {getAuthorizedOAuth2ClientOrDie} from '../apiutils.js';
import {ClaspError} from '../clasp-error.js';
import {Conf} from '../conf.js';
import {fetchProject, hasProject, writeProjectFiles} from '../files.js';
import {ERROR, LOG} from '../messages.js';
import {extractScriptId} from '../urls.js';
import {checkIfOnlineOrDie, saveProject, spinner, stopSpinner} from '../utils.js';
import {showFileStatusCommand} from './status.js';

const config = Conf.get();

interface CommandOption {
  readonly rootDir: string;
}

/**
 * Fetches an Apps Script project.
 * Prompts the user if no script ID is provided.
 * @param scriptId {string} The Apps Script project ID or project URL to fetch.
 * @param versionNumber {string} An optional version to pull the script from.
 * @param options.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                        If not specified, clasp will default to the current directory.
 */
export async function cloneProjectCOmmand(
  scriptId: string | undefined,
  versionNumber: number | undefined,
  options: CommandOption,
): Promise<void> {
  if (options.rootDir) {
    config.projectRootDirectory = options.rootDir;
  }

  if (hasProject()) {
    throw new ClaspError(ERROR.FOLDER_EXISTS());
  }

  await checkIfOnlineOrDie();

  const oauth2Client = await getAuthorizedOAuth2ClientOrDie();
  const id = scriptId ? extractScriptId(scriptId) : await getScriptId(oauth2Client);

  spinner.start(LOG.CLONING);
  try {
    const files = await fetchProject(oauth2Client, id, versionNumber);
    await saveProject({scriptId: id, rootDir: config.projectRootDirectory}, false);
    await writeProjectFiles(files, config.projectRootDirectory);
  } finally {
    stopSpinner();
  }
  await showFileStatusCommand();
}

/**
 * Lists a user's AppsScripts and prompts them to choose one to clone.
 */
async function getScriptId(oauth2Client: OAuth2Client): Promise<string> {
  const drive = google.drive({version: 'v3', auth: oauth2Client});

  const {data, statusText} = await drive.files.list({
    fields: 'files(id, name)',
    orderBy: 'modifiedByMeTime desc',
    pageSize: 20,
    q: 'mimeType="application/vnd.google-apps.script"',
  });

  if (!data) {
    throw new ClaspError(statusText ?? 'Unable to use the Drive API.');
  }

  const files = data.files ?? [];

  if (files.length > 0) {
    const choices = files.map((file: Readonly<driveV3.Schema$File>) => ({
      name: `${file.name!.padEnd(20)} - ${LOG.SCRIPT_LINK(file.id ?? '')}`,
      value: file.id ?? '',
    }));
    const {scriptId} = await inquirer.prompt([
      {
        choices: choices,
        message: LOG.CLONE_SCRIPT_QUESTION,
        name: 'scriptId',
        pageSize: 30,
        type: 'list',
      },
    ]);
    return scriptId;
  }

  throw new ClaspError(LOG.FINDING_SCRIPTS_DNE);
}
