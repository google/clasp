import {getAllProjectFiles, getOrderedProjectFiles, logFileList, splitProjectFiles} from '../files.js';
import {LOG} from '../messages.js';
import {getProjectSettings} from '../utils.js';

interface CommandOption {
  readonly json?: boolean;
}

/**
 * Displays the status of which Apps Script files are ignored from .claspignore
 * @param options.json {boolean} Displays the status in json format.
 */
export default async ({json}: CommandOption = {json: false}): Promise<void> => {
  const {filePushOrder, scriptId, rootDir} = await getProjectSettings();
  if (scriptId) {
    const [toPush, toIgnore] = splitProjectFiles(await getAllProjectFiles(rootDir));
    const filesToPush = getOrderedProjectFiles(toPush, filePushOrder).map(file => file.name);
    const untrackedFiles = toIgnore.map(file => file.name);

    if (json) {
      console.log(JSON.stringify({filesToPush, untrackedFiles}));
      return;
    }

    console.log(LOG.STATUS_PUSH);
    logFileList(filesToPush);
    console.log(); // Separate Ignored files list.
    console.log(LOG.STATUS_IGNORE);
    logFileList(untrackedFiles);
  }
};
