import {readFileSync} from 'fs-extra';
import multimatch from 'multimatch';
import normalizeNewline from 'normalize-newline';
import path from 'path';
import {watchTree} from 'watch';

import {loadAPICredentials} from '../auth';
import {ClaspError} from '../clasp-error';
import {FS_OPTIONS, PROJECT_MANIFEST_BASENAME, PROJECT_MANIFEST_FILENAME} from '../constants';
import {DOT, DOTFILE, ProjectSettings} from '../dotfile';
import {fetchProject, pushFiles} from '../files';
import {overwritePrompt} from '../inquirer';
import {isValidManifest} from '../manifest';
import {LOG} from '../messages';
import {checkIfOnlineOrDie, getProjectSettings, spinner} from '../utils';

interface CommandOption {
  readonly watch?: boolean;
  readonly force?: boolean;
}

/**
 * Uploads all files into the script.google.com filesystem.
 * TODO: Only push the specific files that changed (rather than all files).
 * @param options.watch {boolean} If true, runs `clasp push` when any local file changes. Exit with ^C.
 */
export default async (options: CommandOption): Promise<void> => {
  await checkIfOnlineOrDie();
  await loadAPICredentials();
  await isValidManifest();
  const projectSettings = await getProjectSettings();
  const {rootDir = '.'} = projectSettings;

  if (options.watch) {
    console.log(LOG.PUSH_WATCH);
    const patterns = await DOTFILE.IGNORE();
    /**
     * @see https://www.npmjs.com/package/watch
     */
    // TODO check alternative https://github.com/paulmillr/chokidar
    // TODO better use of watchTree api
    watchTree(rootDir, {}, async f => {
      // The first watch doesn't give a string for some reason.
      if (typeof f === 'string') {
        console.log(`\n${LOG.PUSH_WATCH_UPDATED(f)}\n`);
        if (multimatch([f], patterns, {dot: true}).length > 0) {
          // The file matches the ignored files patterns so we do nothing
          return;
        }
      }

      if (!options.force && (await manifestHasChanges(projectSettings)) && !(await confirmManifestUpdate())) {
        console.log('Stopping push…');
        return;
      }

      console.log(LOG.PUSHING);
      await pushFiles();
    });

    return;
  }

  if (!options.force && (await manifestHasChanges(projectSettings)) && !(await confirmManifestUpdate())) {
    console.log('Stopping push…');
    return;
  }

  spinner.start(LOG.PUSHING);
  await pushFiles();
};

/**
 * Confirms that the manifest file has been updated.
 * @returns {Promise<boolean>}
 */
const confirmManifestUpdate = async (): Promise<boolean> => (await overwritePrompt()).overwrite;

/**
 * Checks if the manifest has changes.
 * @returns {Promise<boolean>}
 */
const manifestHasChanges = async (projectSettings: ProjectSettings): Promise<boolean> => {
  const {scriptId, rootDir = DOT.PROJECT.DIR} = projectSettings;
  const localManifest = readFileSync(path.join(rootDir, PROJECT_MANIFEST_FILENAME), FS_OPTIONS);
  const remoteFiles = await fetchProject(scriptId, undefined, true);
  const remoteManifest = remoteFiles.find(file => file.name === PROJECT_MANIFEST_BASENAME);
  if (remoteManifest) {
    return normalizeNewline(localManifest) !== normalizeNewline(remoteManifest.source);
  }

  throw new ClaspError('remote manifest no found');
};
