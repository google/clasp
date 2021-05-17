import chokidar from 'chokidar';
import fs from 'fs-extra';
import multimatch from 'multimatch';
import normalizeNewline from 'normalize-newline';
import path from 'path';

import {loadAPICredentials} from '../auth.js';
import {ClaspError} from '../clasp-error.js';
import {Conf} from '../conf.js';
import {FS_OPTIONS, PROJECT_MANIFEST_BASENAME, PROJECT_MANIFEST_FILENAME} from '../constants.js';
import {DOTFILE} from '../dotfile.js';
import {fetchProject, pushFiles} from '../files.js';
import {overwritePrompt} from '../inquirer.js';
import {isValidManifest} from '../manifest.js';
import {LOG} from '../messages.js';
import {checkIfOnlineOrDie, getProjectSettings, spinner} from '../utils.js';

import type {ProjectSettings} from '../dotfile';

const {readFileSync} = fs;
const {project} = Conf.get();

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
    const watcher = chokidar.watch(rootDir);
    watcher.on('all', async (event, path) => {
      if (event === 'add' || event === 'change') {
        console.log(`\n${LOG.PUSH_WATCH_UPDATED(path)}\n`);
        // The file does not match the ignored files patterns
        if (multimatch([path], patterns, {dot: true}).length === 0) {
          if (!options.force && (await manifestHasChanges(projectSettings)) && !(await confirmManifestUpdate())) {
            console.log('Stopping push…');
          } else {
            console.log(LOG.PUSHING);
            await pushFiles();
          }
        }
      }
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
  const {scriptId, rootDir = project.resolvedDir} = projectSettings;
  const localManifest = readFileSync(path.join(rootDir, PROJECT_MANIFEST_FILENAME), FS_OPTIONS);
  const remoteFiles = await fetchProject(scriptId, undefined, true);
  const remoteManifest = remoteFiles.find(file => file.name === PROJECT_MANIFEST_BASENAME);
  if (remoteManifest) {
    return normalizeNewline(localManifest) !== normalizeNewline(remoteManifest.source);
  }

  throw new ClaspError('remote manifest no found');
};
