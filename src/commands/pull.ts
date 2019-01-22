import {
  checkIfOnline,
  getProjectSettings,
  LOG,
  spinner,
 } from './../utils';

import {
  fetchProject,
  writeProjectFiles,
} from './../files';

/**
 * Force downloads all Apps Script project files into the local filesystem.
 * @param cmd.versionNumber {number} The version number of the project to retrieve.
 *                             If not provided, the project's HEAD version is returned.
 */
export default async (cmd: { versionNumber: number }) => {
  await checkIfOnline();
  const { scriptId, rootDir } = await getProjectSettings();
  if (scriptId) {
    spinner.setSpinnerTitle(LOG.PULLING);
    const files = await fetchProject(scriptId, cmd.versionNumber);
    await writeProjectFiles(files, rootDir);
  }
};