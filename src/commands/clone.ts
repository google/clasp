import {
  drive,
  loadAPICredentials,
} from './../auth';

import {
  checkIfOnline,
  ERROR,
  LOG,
  logError,
  saveProject,
  spinner,
} from './../utils';

import {
  fetchProject,
  hasProject,
  writeProjectFiles,
} from './../files';

const padEnd = require('string.prototype.padend');
const prompt = require('inquirer').prompt;

/**
 * Fetches an Apps Script project.
 * Prompts the user if no script ID is provided.
 * @param scriptId {string} The Apps Script project ID to fetch.
 * @param versionNumber {string} An optional version to pull the script from.
 * @param cmd.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                    If not specified, clasp will default to the current directory.
 */
export default async (scriptId: string, versionNumber: number, cmd: { rootDir: string }) => {
  await checkIfOnline();
  if (hasProject()) return logError(null, ERROR.FOLDER_EXISTS);
  if (!scriptId) {
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
    const fileIds = files.map((file: any) => {
      return {
        name: `${padEnd(file.name, 20)} – ${LOG.SCRIPT_LINK(file.id)}`,
        value: file.id,
      };
    });
    const answers = await prompt([
      {
        type: 'list',
        name: 'scriptId',
        message: LOG.CLONE_SCRIPT_QUESTION,
        choices: fileIds,
        pageSize: 30,
      },
    ]);
    scriptId = answers.scriptId;
  }
  // We have a scriptId or URL
  // If we passed a URL, extract the scriptId from that. For example:
  // https://script.google.com/a/DOMAIN/d/1Ng7bNZ1K95wNi2H7IUwZzM68FL6ffxQhyc_ByV42zpS6qAFX8pFsWu2I/edit
  if (scriptId.length !== 57) {
    // 57 is the magic number
    const ids = scriptId.split('/').filter(s => {
      return s.length === 57;
    });
    if (ids.length) {
      scriptId = ids[0];
    }
  }
  spinner.setSpinnerTitle(LOG.CLONING);
  const rootDir = cmd.rootDir;
  saveProject({
    scriptId,
    rootDir,
  }, false);
  const files = await fetchProject(scriptId, versionNumber);
  await writeProjectFiles(files, rootDir);
};