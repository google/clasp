import {Command} from 'commander';

import {Context, assertScriptSettings} from '../context.js';
import {getAllProjectFiles, getOrderedProjectFiles, logFileList, splitProjectFiles} from '../files.js';
import {LOG} from '../messages.js';

interface CommandOption {
  readonly json?: boolean;
}

/**
 * Displays the status of which Apps Script files are ignored from .claspignore
 * @param options.json {boolean} Displays the status in json format.
 */
export async function showFileStatusCommand(this: Command, options?: CommandOption): Promise<void> {
  const context: Context = this.opts().context;
  assertScriptSettings(context);

  const [toPush, toIgnore] = splitProjectFiles(
    await getAllProjectFiles(context.project.contentDir, context.project.ignorePatterns, context.project.recursive),
  );
  const filesToPush = getOrderedProjectFiles(toPush, context.project.settings.filePushOrder).map(
    file => file.localPath,
  );
  const untrackedFiles = toIgnore.map(file => file.localPath);

  if (options?.json) {
    console.log(JSON.stringify({filesToPush, untrackedFiles}));
    return;
  }

  console.log(LOG.STATUS_PUSH);
  logFileList(filesToPush);
  console.log(); // Separate Ignored files list.
  console.log(LOG.STATUS_IGNORE);
  logFileList(untrackedFiles);
}
