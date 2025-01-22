import {readFileSync} from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import {Command} from 'commander';
import debounce from 'debounce';
import inquirer from 'inquirer';

import {OAuth2Client} from 'google-auth-library';
import multimatch from 'multimatch';
import normalizeNewline from 'normalize-newline';
import {ClaspError} from '../clasp-error.js';
import {PROJECT_MANIFEST_BASENAME, PROJECT_MANIFEST_FILENAME} from '../constants.js';
import {fetchProject, pushFiles} from '../files.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, spinner} from '../utils.js';

import {Context, assertAuthenticated, assertScriptSettings} from '../context.js';

const WATCH_DEBOUNCE_MS = 1000;

interface CommandOption {
  readonly watch?: boolean;
  readonly force?: boolean;
}

/**
 * Uploads all files into the script.google.com filesystem.
 * TODO: Only push the specific files that changed (rather than all files).
 * @param options.watch {boolean} If true, runs `clasp push` when any local file changes. Exit with ^C.
 */
export async function pushFilesCommand(this: Command, options: CommandOption): Promise<void> {
  await checkIfOnlineOrDie();

  const context: Context = this.opts().context;
  assertAuthenticated(context);
  assertScriptSettings(context);

  if (options.watch) {
    console.log(LOG.PUSH_WATCH);
    // Debounce calls to push to coalesce 'save all' actions from editors
    const debouncedPushFiles = debounce(async () => {
      if (
        !options.force &&
        (await manifestHasChanges(
          context.credentials,
          context.project.settings.scriptId,
          context.project.contentDir,
        )) &&
        !(await confirmManifestUpdate())
      ) {
        console.log('Stopping push…');
        return;
      }

      console.log(LOG.PUSHING);
      return pushFiles(context.credentials, context.project);
    }, WATCH_DEBOUNCE_MS);
    const watchCallback = async (filePath: string) => {
      if (multimatch([filePath], context.project.ignorePatterns, {dot: true}).length > 0) {
        // The file matches the ignored files patterns so we do nothing
        return;
      }
      console.log(`\n${LOG.PUSH_WATCH_UPDATED(filePath)}\n`);
      return debouncedPushFiles();
    };
    const watcher = chokidar.watch(context.project.contentDir, {persistent: true, ignoreInitial: true});
    watcher.on('ready', () => pushFiles(context.credentials, context.project)); // Push on start
    watcher.on('add', watchCallback);
    watcher.on('change', watchCallback);
    watcher.on('unlink', watchCallback);

    return;
  }

  if (
    !options.force &&
    (await manifestHasChanges(context.credentials, context.project.settings.scriptId, context.project.contentDir)) &&
    !(await confirmManifestUpdate())
  ) {
    console.log('Stopping push…');
    return;
  }

  spinner.start(LOG.PUSHING);
  await pushFiles(context.credentials, context.project);
}

/**
 * Confirms that the manifest file has been updated.
 * @returns {Promise<boolean>}
 */
async function confirmManifestUpdate(): Promise<boolean> {
  const answer = await inquirer.prompt([
    {
      default: false,
      message: 'Manifest file has been updated. Do you want to push and overwrite?',
      name: 'overwrite',
      type: 'confirm',
    },
  ]);
  return answer.overwrite;
}

/**
 * Checks if the manifest has changes.
 * @returns {Promise<boolean>}
 */
async function manifestHasChanges(oauth2Client: OAuth2Client, scriptId: string, contentDir: string): Promise<boolean> {
  const manifestPath = path.join(contentDir, PROJECT_MANIFEST_FILENAME);
  const localManifest = readFileSync(manifestPath, {encoding: 'utf8'});
  const remoteFiles = await fetchProject(oauth2Client, scriptId, undefined, true);
  const remoteManifest = remoteFiles.find(file => file.name === PROJECT_MANIFEST_BASENAME);
  if (remoteManifest) {
    console.log(normalizeNewline(localManifest));
    console.log(normalizeNewline(remoteManifest.source));
    return normalizeNewline(localManifest) !== normalizeNewline(remoteManifest.source);
  }

  throw new ClaspError('remote manifest no found');
}
