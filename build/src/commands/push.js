import fs from 'fs-extra';
import multimatch from 'multimatch';
import normalizeNewline from 'normalize-newline';
import path from 'path';
import chokidar from 'chokidar';
import debouncePkg from 'debounce';
import { loadAPICredentials } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { Conf } from '../conf.js';
import { FS_OPTIONS, PROJECT_MANIFEST_BASENAME, PROJECT_MANIFEST_FILENAME } from '../constants.js';
import { DOTFILE } from '../dotfile.js';
import { fetchProject, pushFiles } from '../files.js';
import { overwritePrompt } from '../inquirer.js';
import { isValidManifest } from '../manifest.js';
import { LOG } from '../messages.js';
import { getProjectSettings, spinner } from '../utils.js';
const { debounce } = debouncePkg;
const { readFileSync } = fs;
const WATCH_DEBOUNCE_MS = 1000;
const config = Conf.get();
/**
 * Uploads all files into the script.google.com filesystem.
 * TODO: Only push the specific files that changed (rather than all files).
 * @param options.watch {boolean} If true, runs `clasp push` when any local file changes. Exit with ^C.
 */
export default async (options) => {
    await loadAPICredentials();
    await isValidManifest();
    const projectSettings = await getProjectSettings();
    const { rootDir = '.' } = projectSettings;
    if (options.watch) {
        console.log(LOG.PUSH_WATCH);
        // Debounce calls to push to coalesce 'save all' actions from editors
        const debouncedPushFiles = debounce(async () => {
            if (!options.force && (await manifestHasChanges(projectSettings)) && !(await confirmManifestUpdate())) {
                console.log('Stopping push…');
                return;
            }
            console.log(LOG.PUSHING);
            return pushFiles();
        }, WATCH_DEBOUNCE_MS);
        const patterns = await DOTFILE.IGNORE();
        const watchCallback = async (filePath) => {
            if (multimatch([filePath], patterns, { dot: true }).length > 0) {
                // The file matches the ignored files patterns so we do nothing
                return;
            }
            console.log(`\n${LOG.PUSH_WATCH_UPDATED(filePath)}\n`);
            return debouncedPushFiles();
        };
        const watcher = chokidar.watch(rootDir, { persistent: true, ignoreInitial: true });
        watcher.on('ready', pushFiles); // Push on start
        watcher.on('add', watchCallback);
        watcher.on('change', watchCallback);
        watcher.on('unlink', watchCallback);
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
const confirmManifestUpdate = async () => (await overwritePrompt()).overwrite;
/**
 * Checks if the manifest has changes.
 * @returns {Promise<boolean>}
 */
const manifestHasChanges = async (projectSettings) => {
    const { scriptId, rootDir = config.projectRootDirectory } = projectSettings;
    const localManifest = readFileSync(path.join(rootDir, PROJECT_MANIFEST_FILENAME), FS_OPTIONS);
    const remoteFiles = await fetchProject(scriptId, undefined, true);
    const remoteManifest = remoteFiles.find(file => file.name === PROJECT_MANIFEST_BASENAME);
    if (remoteManifest) {
        return normalizeNewline(localManifest) !== normalizeNewline(remoteManifest.source);
    }
    throw new ClaspError('remote manifest no found');
};
//# sourceMappingURL=push.js.map