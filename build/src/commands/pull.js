import { fetchProject, writeProjectFiles } from '../files.js';
import { LOG } from '../messages.js';
import { getProjectSettings, spinner, stopSpinner } from '../utils.js';
/**
 * Force downloads all Apps Script project files into the local filesystem.
 * @param options.versionNumber {number} The version number of the project to retrieve.
 *                              If not provided, the project's HEAD version is returned.
 */
export default async (options) => {
    const { scriptId, rootDir } = await getProjectSettings();
    if (scriptId) {
        spinner.start(LOG.PULLING);
        const files = await fetchProject(scriptId, options.versionNumber);
        await writeProjectFiles(files, rootDir);
        stopSpinner();
    }
};
//# sourceMappingURL=pull.js.map