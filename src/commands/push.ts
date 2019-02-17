import multimatch = require('multimatch');

import { readFileSync } from 'fs';
import * as path from 'path';
import { watchTree } from 'watch';
import { loadAPICredentials } from '../auth';
import { DOT, DOTFILE } from '../dotfile';
import {
  fetchProject,
  pushFiles,
} from '../files';
import { isValidManifest } from '../manifest';
import {
  LOG,
  PROJECT_MANIFEST_BASENAME,
  PROJECT_MANIFEST_FILENAME,
  checkIfOnline,
  getProjectSettings,
  spinner,
} from '../utils';
const prompt = require('inquirer').prompt;

/**
 * Uploads all files into the script.google.com filesystem.
 * TODO: Only push the specific files that changed (rather than all files).
 * @param cmd.watch {boolean} If true, runs `clasp push` when any local file changes. Exit with ^C.
 */
export default async (cmd: { watch: boolean, force: boolean }) => {
  await checkIfOnline();
  await loadAPICredentials();
  await isValidManifest();
  const { rootDir } = await getProjectSettings();

  if (cmd.watch) {
    await watchFiles({
      rootDir: rootDir || '.',
      force: true,
    });
  } else {
    if (!cmd.force && await manifestHasChanges() && !await confirmManifestUpdate()) {
      console.log('Stopping push...');
      return;
    }
    pushFiles();
  }
};

/**
 * Checks if the manifest has changes.
 */
const manifestHasChanges = async (): Promise<boolean> => {
  const { scriptId, rootDir } = await getProjectSettings();
  const localManifestPath = path.join(rootDir || DOT.PROJECT.DIR, PROJECT_MANIFEST_FILENAME);
  const localManifest = readFileSync(localManifestPath, 'utf8');
  const remoteFiles = await fetchProject(scriptId, undefined, true);
  const remoteManifest = remoteFiles.find((file) => file.name === PROJECT_MANIFEST_BASENAME);
  if (!remoteManifest) throw Error('remote manifest no found');
  return localManifest !== remoteManifest.source;
};

/**
 * Confirms that the manifest wants to be overwritten.
 */
const confirmManifestUpdate = async (): Promise<boolean> => {
  const answers = await prompt([{
    name: 'overwrite',
    type: 'confirm',
    message: 'Manifest file has been updated. Do you want to push and overwrite?',
    default: false,
  }]) as { overwrite: boolean };
  return answers.overwrite;
};

/**
 * A function that continually watches for changed files in the specified directory.
 * Pushes when a file changed.
 */
const watchFiles = async ({
  rootDir,
  force,
}: {
  rootDir: string,
  force: boolean,
}) => {
  console.log(LOG.PUSH_WATCH);
  const patterns = await DOTFILE.IGNORE();
  // @see https://www.npmjs.com/package/watch
  watchTree(rootDir, async (f, curr, prev) => {
    // The first watch doesn't give a string for some reason.
    if (typeof f === 'string') {
      console.log(`\n${LOG.PUSH_WATCH_UPDATED(f)}\n`);
      if (multimatch([f], patterns).length) {
        // The file matches the ignored files patterns so we do nothing
        return;
      }
    }
    if (!force && await manifestHasChanges() && !await confirmManifestUpdate()) {
      console.log('Stopping push...');
      return;
    }
    console.log(LOG.PUSHING);
    pushFiles();
  });
};