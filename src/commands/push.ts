/* eslint-disable new-cap */
import { readFileSync } from 'fs-extra';
import multimatch from 'multimatch';
import normalizeNewline from 'normalize-newline';
import path from 'path';
import { watchTree } from 'watch';

import { loadAPICredentials } from '../auth';
import { DOT, DOTFILE } from '../dotfile';
import { fetchProject, FS_OPTIONS, pushFiles } from '../files';
import { overwritePrompt } from '../inquirer';
import { isValidManifest } from '../manifest';
import {
  checkIfOnline,
  getProjectSettings,
  LOG,
  PROJECT_MANIFEST_BASENAME,
  PROJECT_MANIFEST_FILENAME,
  spinner,
} from '../utils';

/**
 * Uploads all files into the script.google.com filesystem.
 * TODO: Only push the specific files that changed (rather than all files).
 * @param cmd.watch {boolean} If true, runs `clasp push` when any local file changes. Exit with ^C.
 */
export default async (cmd: { readonly watch: boolean; readonly force: boolean }): Promise<void> => {
  await checkIfOnline();
  await loadAPICredentials();
  await isValidManifest();
  const { rootDir } = await getProjectSettings();

  if (cmd.watch) {
    console.log(LOG.PUSH_WATCH);
    const patterns = await DOTFILE.IGNORE();
    /**
     * @see https://www.npmjs.com/package/watch
     */
    // TODO check alternative https://github.com/paulmillr/chokidar
    watchTree(rootDir ?? '.', async (f) => {
      // The first watch doesn't give a string for some reason.
      if (typeof f === 'string') {
        console.log(`\n${LOG.PUSH_WATCH_UPDATED(f)}\n`);
        if (multimatch([f], patterns, { dot: true }).length > 0) {
          // The file matches the ignored files patterns so we do nothing
          return;
        }
      }

      if (!cmd.force && (await manifestHasChanges()) && !(await confirmManifestUpdate())) {
        console.log('Stopping push…');
        return;
      }

      console.log(LOG.PUSHING);
      await pushFiles();
    });
  } else {
    if (!cmd.force && (await manifestHasChanges()) && !(await confirmManifestUpdate())) {
      console.log('Stopping push…');
      return;
    }

    spinner.setSpinnerTitle(LOG.PUSHING).start();
    await pushFiles();
    if (spinner.isSpinning()) spinner.stop(true);
  }
};

/**
 * Confirms that the manifest file has been updated.
 * @returns {Promise<boolean>}
 */
const confirmManifestUpdate = async (): Promise<boolean> => {
  const answers = await overwritePrompt();
  return answers.overwrite;
};

/**
 * Checks if the manifest has changes.
 * @returns {Promise<boolean>}
 */
const manifestHasChanges = async (): Promise<boolean> => {
  const { scriptId, rootDir } = await getProjectSettings();
  const localManifestPath = path.join(rootDir ?? DOT.PROJECT.DIR, PROJECT_MANIFEST_FILENAME);
  const localManifest = readFileSync(localManifestPath, FS_OPTIONS);
  const remoteFiles = await fetchProject(scriptId, undefined, true);
  const remoteManifest = remoteFiles.find((file) => file.name === PROJECT_MANIFEST_BASENAME);
  if (!remoteManifest) throw new Error('remote manifest no found');
  return normalizeNewline(localManifest) !== normalizeNewline(remoteManifest.source);
};
