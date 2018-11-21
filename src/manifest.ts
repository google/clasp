import * as fs from 'fs';
import { DOT } from './dotfile';
import { ERROR, PROJECT_MANIFEST_FILENAME, getProjectSettings, logError } from './utils';
const path = require('path');

/**
 * Checks if the rootDir appears to be a valid project.
 * @return {boolean} True if valid project, false otherwise
 */
export const manifestExists = (rootDir: string = DOT.PROJECT.DIR): boolean =>
  fs.existsSync(path.join(rootDir, PROJECT_MANIFEST_FILENAME));

/**
 * Load appsscript.json manifest file.
 * @returns {Promise} A promise to get the manifest file as object.
 * @see https://developers.google.com/apps-script/concepts/manifests
 */
export async function loadManifest(): Promise<any> {
  let { rootDir } = await getProjectSettings();
  if (typeof rootDir === 'undefined') rootDir = DOT.PROJECT.DIR;
  const manifest = path.join(rootDir, PROJECT_MANIFEST_FILENAME);
  try {
    return JSON.parse(fs.readFileSync(manifest, 'utf8'));
  } catch (err) {
    logError(null, ERROR.NO_MANIFEST(manifest));
  }
}
