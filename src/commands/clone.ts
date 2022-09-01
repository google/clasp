import {drive_v3 as driveV3} from 'googleapis';

import {drive, loadAPICredentials} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {fetchProject, hasProject, writeProjectFiles} from '../files.js';
import {ScriptIdPrompt, scriptIdPrompt} from '../inquirer.js';
import {ERROR, LOG} from '../messages.js';
import {extractScriptId} from '../urls.js';
import {saveProject, spinner} from '../utils.js';
import status from './status.js';
import {Conf} from '../conf.js';

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
export default async (
  scriptId: string | undefined,
  versionNumber: number | undefined,
  options: CommandOption
): Promise<void> => {
  if (options.rootDir) {
    config.projectRootDirectory = options.rootDir;
  }
  if (hasProject()) {
    throw new ClaspError(ERROR.FOLDER_EXISTS());
  }

  const id = scriptId ? extractScriptId(scriptId) : await getScriptId();

  spinner.start(LOG.CLONING);

  await saveProject({scriptId: id, rootDir: config.projectRootDirectory}, false);
  await writeProjectFiles(await fetchProject(id, versionNumber), config.projectRootDirectory);
  await status();
};

/**
 * Lists a user's AppsScripts and prompts them to choose one to clone.
 */
const getScriptId = async (): Promise<string> => {
  await loadAPICredentials();
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
