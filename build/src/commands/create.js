import is from '@sindresorhus/is';
import { SCRIPT_TYPES } from '../apis.js';
import { drive, loadAPICredentials, script } from '../auth.js';
import { ClaspError } from '../clasp-error.js';
import { fetchProject, hasProject, writeProjectFiles } from '../files.js';
import { scriptTypePrompt } from '../inquirer.js';
import { manifestExists } from '../manifest.js';
import { ERROR, LOG } from '../messages.js';
import { getDefaultProjectName, getProjectSettings, saveProject, spinner, stopSpinner } from '../utils.js';
import { Conf } from '../conf.js';
const config = Conf.get();
/**
 * Creates a new Apps Script project.
 * @param options.type {string} The type of the Apps Script project.
 * @param options.title {string} The title of the Apps Script project's file
 * @param options.parentId {string} The Drive ID of the G Suite doc this script is bound to.
 * @param options.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                        If not specified, clasp will default to the current directory.
 */
export default async (options) => {
    var _a;
    if (options.rootDir) {
        config.projectRootDirectory = options.rootDir;
    }
    // Handle common errors.
    if (hasProject()) {
        throw new ClaspError(ERROR.FOLDER_EXISTS());
    }
    await loadAPICredentials();
    // Create defaults.
    const { parentId: optionParentId, title: name = getDefaultProjectName(), type: optionType } = options;
    let parentId = optionParentId;
    const filetype = optionType !== null && optionType !== void 0 ? optionType : (optionParentId ? '' : (await scriptTypePrompt()).type);
    // Create files with MIME type.
    // https://developers.google.com/drive/api/v3/mime-types
    const DRIVE_FILE_MIMETYPES = {
        [SCRIPT_TYPES.DOCS]: 'application/vnd.google-apps.document',
        [SCRIPT_TYPES.FORMS]: 'application/vnd.google-apps.form',
        [SCRIPT_TYPES.SHEETS]: 'application/vnd.google-apps.spreadsheet',
        [SCRIPT_TYPES.SLIDES]: 'application/vnd.google-apps.presentation',
    };
    const mimeType = DRIVE_FILE_MIMETYPES[filetype];
    if (mimeType) {
        spinner.start(LOG.CREATE_DRIVE_FILE_START(filetype));
        const { data: { id: newParentId }, } = await drive.files.create({ requestBody: { mimeType, name } });
        parentId = newParentId;
        stopSpinner();
        console.log(LOG.CREATE_DRIVE_FILE_FINISH(filetype, parentId));
    }
    // CLI Spinner
    spinner.start(LOG.CREATE_PROJECT_START(name));
    let projectExist;
    try {
        projectExist = is.string((await getProjectSettings()).scriptId);
    }
    catch {
        process.exitCode = 0; // To reset `exitCode` that was overriden in ClaspError constructor.
        projectExist = false;
    }
    if (projectExist) {
        throw new ClaspError(ERROR.NO_NESTED_PROJECTS);
    }
    // Create a new Apps Script project
    const { data, status, statusText } = await script.projects.create({
        requestBody: { parentId, title: name },
    });
    stopSpinner();
    if (status !== 200) {
        if (parentId) {
            console.log(statusText, ERROR.CREATE_WITH_PARENT);
        }
        throw new ClaspError(statusText !== null && statusText !== void 0 ? statusText : ERROR.CREATE);
    }
    const scriptId = (_a = data.scriptId) !== null && _a !== void 0 ? _a : '';
    console.log(LOG.CREATE_PROJECT_FINISH(filetype, scriptId));
    await saveProject({ scriptId, rootDir: config.projectRootDirectory, parentId: parentId ? [parentId] : undefined }, false);
    if (!manifestExists(config.projectRootDirectory)) {
        await writeProjectFiles(await fetchProject(scriptId), config.projectRootDirectory); // Fetches appsscript.json, o.w. `push` breaks
    }
};
//# sourceMappingURL=create.js.map