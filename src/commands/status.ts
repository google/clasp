import {getAllProjectFiles, getOrderedProjectFiles, logFileList, splitProjectFiles} from '../files';
// import {isValidManifest} from '../manifest';
import {LOG} from '../messages';
import {checkIfOnlineOrDie, getProjectSettings} from '../utils';

interface CommandOption {
  readonly json?: boolean;
}

/**
 * Displays the status of which Apps Script files are ignored from .claspignore
 * @param options.json {boolean} Displays the status in json format.
 */
export default async (options: CommandOption = {json: false}): Promise<void> => {
  await checkIfOnlineOrDie();
  // await isValidManifest();
  const {filePushOrder, scriptId, rootDir} = await getProjectSettings();
  if (scriptId) {
    const [toPush, toIgnore] = splitProjectFiles(await getAllProjectFiles(rootDir));
    const filesToPush = getOrderedProjectFiles(toPush, filePushOrder).map(file => file.name);
    const filesToIgnore = toIgnore.map(file => file.name);

    if (options.json) {
      console.log(JSON.stringify({filesToPush, untrackedFiles: filesToIgnore}));
    } else {
      console.log(LOG.STATUS_PUSH);
      logFileList(filesToPush);
      console.log(); // Separate Ignored files list.
      console.log(LOG.STATUS_IGNORE);
      logFileList(filesToIgnore);
    }
  }
};
