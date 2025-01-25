import {Command} from 'commander';
import {Context, assertAuthenticated, assertScriptSettings} from '../context.js';
import {fetchProject, writeProjectFiles} from '../files.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, spinner, stopSpinner} from '../utils.js';

interface CommandOption {
  readonly versionNumber?: number;
}

/**
 * Force downloads all Apps Script project files into the local filesystem.
 * @param options.versionNumber {number} The version number of the project to retrieve.
 *                              If not provided, the project's HEAD version is returned.
 */
export async function pullFilesCommand(this: Command, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();

  const context: Context = this.opts().context;
  assertAuthenticated(context);
  assertScriptSettings(context);

  spinner.start(LOG.PULLING);

  const files = await fetchProject(context.credentials, context.project.settings.scriptId, options.versionNumber);
  const paths = await writeProjectFiles(files, context.project);
  paths.forEach(p => console.log(`└─ ${p}`));
  console.log(LOG.CLONE_SUCCESS(files.length));

  stopSpinner();
}
