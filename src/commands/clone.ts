import {drive_v3 as driveV3, google} from 'googleapis';

import {ClaspError} from '../clasp-error.js';
import {fetchProject, hasProject, writeProjectFiles} from '../files.js';
import {ScriptIdPrompt, scriptIdPrompt} from '../inquirer.js';
import {ERROR, LOG} from '../messages.js';
import {extractScriptId} from '../urls.js';
import {saveProject, spinner} from '../utils.js';
import {showFiletatusCommand} from './status.js';
import {Conf} from '../conf.js';
import {getAuthorizedOAuth2Client} from '../auth.js';

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

  const id = scriptId ? extractScriptId(scriptId) : await getScriptId();

  spinner.start(LOG.CLONING);

  const files = await fetchProject(id, versionNumber);
  await saveProject({scriptId: id, rootDir: config.projectRootDirectory}, false);
  await writeProjectFiles(files, config.projectRootDirectory);
  await showFiletatusCommand();
}

/**
 * Lists a user's AppsScripts and prompts them to choose one to clone.
 */
const getScriptId = async (): Promise<string> => {
  const oauth2Client = await getAuthorizedOAuth2Client();
  if (!oauth2Client) {
    throw new ClaspError(ERROR.NO_CREDENTIALS(false));
  }

  const drive = google.drive({version: 'v3', auth: oauth2Client});

  const {data, statusText} = await drive.files.list({
    // fields: 'files(id, name)',
    orderBy: 'modifiedByMeTime desc',
    // pageSize: 10,
    q: 'mimeType="application/vnd.google-apps.script"',
  });
  if (!data) {
    throw new ClaspError(statusText ?? 'Unable to use the Drive API.');
  }

  const {files = []} = data;
  if (files.length > 0) {
    const fileIds: ScriptIdPrompt[] = files.map((file: Readonly<driveV3.Schema$File>) => ({
      name: `${file.name!.padEnd(20)} - ${LOG.SCRIPT_LINK(file.id ?? '')}`,
      value: file.id ?? '',
    }));

    return (await scriptIdPrompt(fileIds)).scriptId;
  }

  throw new ClaspError(LOG.FINDING_SCRIPTS_DNE);
};
