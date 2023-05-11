import path from 'path';
import is from '@sindresorhus/is';
import fs from 'fs-extra';
import { PUBLIC_ADVANCED_SERVICES as publicAdvancedServices } from './apis.js';
import { ClaspError } from './clasp-error.js';
import { Conf } from './conf.js';
import { FS_OPTIONS, PROJECT_MANIFEST_FILENAME } from './constants.js';
import { ERROR } from './messages.js';
import { getProjectSettings, parseJsonOrDie } from './utils.js';
const config = Conf.get();
/** Gets the path to manifest for given `rootDir` */
const getManifestPath = (rootDir) => path.join(rootDir, PROJECT_MANIFEST_FILENAME);
/** Gets the `rootDir` from given project */
const getRootDir = ({ rootDir }) => is.string(rootDir) ? rootDir : config.projectRootDirectory;
/**
 * Checks if the rootDir appears to be a valid project.
 *
 * @param {string} rootDir dir to check.
 *
 * @return {boolean} True if valid project, false otherwise
 */
export const manifestExists = (rootDir = config.projectRootDirectory) => rootDir !== undefined && fs.existsSync(getManifestPath(rootDir));
/**
 * Reads the appsscript.json manifest file.
 * @returns {Promise<Manifest>} A promise to get the manifest file as object.
 * @see https://developers.google.com/apps-script/concepts/manifests
 */
export const readManifest = async () => {
    const manifest = getManifestPath(getRootDir(await getProjectSettings()));
    try {
        return fs.readJsonSync(manifest, FS_OPTIONS);
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        throw new ClaspError(ERROR.NO_MANIFEST(manifest));
    }
};
/**
 * Writes the appsscript.json manifest file.
 * @param {Manifest} manifest The new manifest to write.
 */
const writeManifest = async (manifest) => {
    try {
        fs.writeJsonSync(getManifestPath(getRootDir(await getProjectSettings())), manifest, { encoding: 'utf8', spaces: 2 });
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        throw new ClaspError(ERROR.FS_FILE_WRITE);
    }
};
/**
 * Returns true if the manifest is valid.
 */
export const isValidManifest = async (manifest) => !is.nullOrUndefined(manifest !== null && manifest !== void 0 ? manifest : (await getManifest()));
/**
 * Ensures the manifest is correct for running a function.
 * The manifest must include:
 * "executionApi": {
 *   "access": "MYSELF"
 * }
 */
export const isValidRunManifest = async () => {
    const value = await getManifest();
    return Boolean((await isValidManifest(value)) && value.executionApi && value.executionApi.access);
};
/**
 * Reads manifest file from project root dir.
 * The manifest is valid if it:
 * - It exists in the project root.
 * - Is valid JSON.
 */
export const getManifest = async () => parseJsonOrDie(fs.readFileSync(getManifestPath(getRootDir(await getProjectSettings())), FS_OPTIONS));
/**
 * Adds a list of scopes to the manifest.
 * @param {string[]} scopes The list of explicit scopes
 */
export const addScopeToManifest = async (scopes) => {
    var _a;
    const manifest = await readManifest();
    manifest.oauthScopes = [...new Set([...((_a = manifest.oauthScopes) !== null && _a !== void 0 ? _a : []), ...scopes])];
    await writeManifest(manifest);
};
// /**
//  * Enables the Execution API in the Manifest.
//  * The Execution API requires the manifest to have the "executionApi.access" field set.
//  */
// // TODO: currently unused. Check relevancy
// export async function enableExecutionAPI() {
//   console.log('Writing manifest');
//   const manifest = await readManifest();
//   manifest.executionApi = manifest.executionApi ?? {
//     access: 'ANYONE',
//   };
//   await writeManifest(manifest);
//   console.log('Wrote manifest');
//   console.log('Checking Apps Script API');
//   if (!(await isEnabled('script'))) {
//     console.log('Apps Script API is currently disabled. Enabling…');
//     await enableOrDisableAPI('script', true);
//   }
//   console.log('Apps Script API is enabled.');
// }
/**
 * Enables or disables an advanced service in the manifest.
 * @param serviceId {string} The id of the service that should be enabled or disabled.
 * @param enable {boolean} True if you want to enable a service. Disables otherwise.
 * @see PUBLIC_ADVANCED_SERVICES
 */
export const enableOrDisableAdvanceServiceInManifest = async (serviceId, enable) => {
    var _a;
    /**
     * "enabledAdvancedServices": [
     *   {
     *     "userSymbol": "string",
     *     "serviceId": "string",
     *     "version": "string",
     *   }
     *   ...
     * ],
     */
    const manifest = await readManifest();
    // Create objects if they don't exist.
    if (!manifest.dependencies) {
        manifest.dependencies = { enabledAdvancedServices: [] };
    }
    // Copy the list of advanced services:
    // Disable the service (even if we may enable it)
    const enabledServices = ((_a = manifest.dependencies.enabledAdvancedServices) !== null && _a !== void 0 ? _a : []).filter((service) => service.serviceId !== serviceId);
    // Enable the service
    if (enable) {
        // Add new service (get the first one from the public list)
        enabledServices.push(publicAdvancedServices.find(service => service.serviceId === serviceId));
    }
    // Overwrites the old list with the new list.
    manifest.dependencies.enabledAdvancedServices = enabledServices;
    await writeManifest(manifest);
};
//# sourceMappingURL=manifest.js.map