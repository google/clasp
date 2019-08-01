import { drive, loadAPICredentials } from '../auth';
import { fetchProject, hasProject, writeProjectFiles } from '../files';
import { ScriptIdPrompt, scriptIdPrompt } from '../inquirer';
import { extractScriptId } from '../urls';
import { ERROR, LOG, checkIfOnline, logError, saveProject, spinner } from '../utils';
import status from './status';

const padEnd = require('string.prototype.padend');

/**
 * Fetches an Apps Script project.
 * Prompts the user if no script ID is provided.
 * @param scriptId {string} The Apps Script project ID or project URL to fetch.
 * @param versionNumber {string} An optional version to pull the script from.
 * @param cmd.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                    If not specified, clasp will default to the current directory.
 */
export default async (scriptId: string, versionNumber: number, cmd: { rootDir: string }) => {
  await checkIfOnline();
  if (hasProject()) return logError(null, ERROR.FOLDER_EXISTS);
  scriptId = scriptId ? extractScriptId(scriptId) : await getScriptId();
  spinner.setSpinnerTitle(LOG.CLONING);
  const rootDir = cmd.rootDir;
  saveProject({ scriptId, rootDir }, false);
  const files = await fetchProject(scriptId, versionNumber);
  await writeProjectFiles(files, rootDir);
  await status();
};

/**
 * Lists a user's AppsScripts and prompts them to choose one to clone.
 */
const getScriptId = async () => {
  await loadAPICredentials();
  const list = await drive.files.list({
    // pageSize: 10,
    // fields: 'files(id, name)',
    orderBy: 'modifiedByMeTime desc',
    q: 'mimeType="application/vnd.google-apps.script"',
  });
  const data = list.data;
  if (!data) {
    logError(list.statusText, 'Unable to use the Drive API.');
    return '';
  }
  const files = data.files;
  if (!files || !files.length) {
    logError(null, LOG.FINDING_SCRIPTS_DNE);
    return '';
  }
  const fileIds: ScriptIdPrompt[] = files.map(file => ({
    name: `${padEnd(file.name, 20)} – ${LOG.SCRIPT_LINK(file.id || '')}`,
    value: file.id || '',
  }));
  const answers = await scriptIdPrompt(fileIds);
  return answers.scriptId;
};
