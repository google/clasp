import {drive_v3 as driveV3} from 'googleapis';

import {drive, loadAPICredentials} from '../auth';
import {ClaspError} from '../clasp-error';
import {fetchProject, hasProject, writeProjectFiles} from '../files';
import {ScriptIdPrompt, scriptIdPrompt} from '../inquirer';
import {ERROR, LOG} from '../messages';
import {extractScriptId} from '../urls';
import {checkIfOnline, saveProject, spinner} from '../utils';
import status from './status';

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
  await checkIfOnline();
  if (hasProject()) throw new ClaspError(ERROR.FOLDER_EXISTS);
  scriptId = scriptId ? extractScriptId(scriptId) : await getScriptId();
  spinner.setSpinnerTitle(LOG.CLONING);
  const {rootDir} = options;
  await saveProject({scriptId, rootDir}, false);
  const files = await fetchProject(scriptId, versionNumber);
  await writeProjectFiles(files, rootDir);
  await status();
};

/**
 * Lists a user's AppsScripts and prompts them to choose one to clone.
 */
const getScriptId = async (): Promise<string> => {
  await loadAPICredentials();
  const list = await drive.files.list({
    // pageSize: 10,
    // fields: 'files(id, name)',
    orderBy: 'modifiedByMeTime desc',
    q: 'mimeType="application/vnd.google-apps.script"',
  });
  const {data} = list;
  if (!data) throw new ClaspError(list.statusText ?? 'Unable to use the Drive API.');
  const {files} = data;
  if (files && files.length > 0) {
    const fileIds: ScriptIdPrompt[] = files.map((file: Readonly<driveV3.Schema$File>) => ({
      name: `${file.name!.padEnd(20)} - ${LOG.SCRIPT_LINK(file.id ?? '')}`,
      value: file.id ?? '',
    }));
    const answers = await scriptIdPrompt(fileIds);
    return answers.scriptId;
  }

  throw new ClaspError(LOG.FINDING_SCRIPTS_DNE);
};
