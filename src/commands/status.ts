import { isValidManifest } from '../manifest';
import {
  LOG,
  checkIfOnline,
  getProjectSettings,
} from '../utils';

/**
 * Displays the status of which Apps Script files are ignored from .claspignore
 * @param cmd.json {boolean} Displays the status in json format.
 */
export default async (cmd: { json: boolean }) => {
  await checkIfOnline();
  await isValidManifest();
  const { scriptId, rootDir } = await getProjectSettings();
  if (!scriptId) return;
  // const projectFiles = await getProjectFiles(rootDir);
  // if (projectFiles) {
  //   // const [filesToPush, untrackedFiles] = projectFiles;
  //   const [filesToPush, untrackedFiles] = [[], []];
  //   if (cmd.json) {
  //     console.log(JSON.stringify({ filesToPush, untrackedFiles }));
  //   } else {
  //     console.log(LOG.STATUS_IGNORE_FALSE);
  //     filesToPush.forEach((file: any) => console.log(`└─ ${file}`));
  //     console.log(LOG.STATUS_IGNORE_TRUE);
  //     untrackedFiles.forEach((file: any) => console.log(`└─ ${file}`));
  //   }
  // }
};