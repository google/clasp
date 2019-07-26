import { getProjectFiles, listFilesHelper } from '../files';
import { isValidManifest } from '../manifest';
import { LOG, checkIfOnline, getProjectSettings } from '../utils';

/**
 * Displays the status of which Apps Script files are ignored from .claspignore
 * @param cmd.json {boolean} Displays the status in json format.
 */
export default async (cmd: { json: boolean } = { json: false }) => {
  await checkIfOnline();
  await isValidManifest();
  const { scriptId, rootDir } = await getProjectSettings();
  if (!scriptId) return;
  getProjectFiles(rootDir, (err, projectFiles) => {
    if (err) return console.log(err);
    if (projectFiles) {
      const [filesToPush, untrackedFiles] = projectFiles;
      if (cmd.json) {
        console.log(JSON.stringify({ filesToPush, untrackedFiles }));
      } else {
        console.log(LOG.STATUS_PUSH);
        console.log(listFilesHelper(filesToPush));
        console.log(); // Separate Ignored files list.
        console.log(LOG.STATUS_IGNORE);
        console.log(listFilesHelper(untrackedFiles));
      }
    }
  });
};
