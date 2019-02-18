import {drive_v3} from 'googleapis';
import {
  drive,
  loadAPICredentials,
} from '../auth';
import {
  fetchProject,
  hasProject,
  writeProjectFiles,
} from '../files';
import {
  extractScriptId,
} from '../urls';
import {
  ERROR,
  LOG,
  checkIfOnline,
  logError,
  saveProject,
  spinner,
} from '../utils';

const padEnd = require('string.prototype.padend');
const prompt = require('inquirer').prompt;

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
  saveProject({
    scriptId,
    rootDir,
  }, false);
  const files = await fetchProject(scriptId, versionNumber);
  await writeProjectFiles(files, rootDir);
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
  if (!data) return logError(list.statusText, 'Unable to use the Drive API.');
  const files = data.files;
  if (!files || !files.length) return console.log(LOG.FINDING_SCRIPTS_DNE);
  const fileIds = files.map((file: drive_v3.Schema$File) => {
    return {
      name: `${padEnd(file.name, 20)} – ${LOG.SCRIPT_LINK(file.id || '')}`,
      value: file.id,
    };
  });
  const answers = await prompt([{
    type: 'list',
    name: 'scriptId',
    message: LOG.CLONE_SCRIPT_QUESTION,
    choices: fileIds,
    pageSize: 30,
  }]);
  return answers.scriptId;
};