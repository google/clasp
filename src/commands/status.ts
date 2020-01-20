import { getProjectFiles, logFileList } from '../files';
import { isValidManifest } from '../manifest';
import { checkIfOnline, getProjectSettings, LOG } from '../utils';

/**
 * Displays the status of which Apps Script files are ignored from .claspignore
 * @param cmd.json {boolean} Displays the status in json format.
 */
export default async (cmd: { json: boolean } = { json: false }): Promise<void> => {
  await checkIfOnline();
  await isValidManifest();
  const { scriptId, rootDir } = await getProjectSettings();
  if (!scriptId) return;
  await getProjectFiles(rootDir, (err, projectFiles) => {
    if (err) {
      console.log(err);
      return;
    }
    if (projectFiles) {
      const [filesToPush, untrackedFiles] = projectFiles;
      if (cmd.json) {
        console.log(JSON.stringify({ filesToPush, untrackedFiles }));
      } else {
        console.log(LOG.STATUS_PUSH);
        logFileList(filesToPush);
        console.log(); // Separate Ignored files list.
        console.log(LOG.STATUS_IGNORE);
        logFileList(untrackedFiles);
      }
    }
  });
};
