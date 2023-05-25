import fs from 'fs-extra';
import makeDir from 'make-dir';
import multimatch from 'multimatch';
import path from 'path';
import pMap from 'p-map';
import recursive from 'recursive-readdir';
import typescript from 'typescript';
import { loadAPICredentials, script } from './auth.js';
import { ClaspError } from './clasp-error.js';
import { Conf } from './conf.js';
import { FS_OPTIONS, PROJECT_MANIFEST_FILENAME } from './constants.js';
import { DOTFILE } from './dotfile.js';
import { ERROR, LOG } from './messages.js';
import { getApiFileType, getErrorMessage, getProjectSettings, spinner, stopSpinner } from './utils.js';
const { parseConfigFileTextToJson } = typescript;
const config = Conf.get();
async function transpile(source, transpileOptions) {
    const ts2gas = await import('ts2gas');
    return ts2gas.default(source, transpileOptions);
}
async function projectFileWithContent(file, transpileOptions) {
    const content = await fs.readFile(file.name);
    let source = content.toString();
    let type = getApiFileType(file.name);
    if (type === 'TS') {
        source = await transpile(source, transpileOptions);
        type = 'SERVER_JS';
    }
    return { ...file, source, type };
}
const ignoredProjectFile = (file) => ({ ...file, source: '', isIgnored: true, type: '' });
const isValidFactory = (rootDir) => {
    const validManifestPath = rootDir ? path.join(rootDir, PROJECT_MANIFEST_FILENAME) : PROJECT_MANIFEST_FILENAME;
    /**
     * Validates a file:
     *
     * - is a manifest file
     * - type is either `SERVER_JS` or `HTML` @see https://developers.google.com/apps-script/api/reference/rest/v1/File
     */
    return (file) => Boolean(file.type === 'JSON' // Has a type or is appsscript.json
        ? (rootDir ? path.normalize(file.name) : file.name) === validManifestPath
        : file.type === 'SERVER_JS' || file.type === 'HTML');
};
/**
 * Return an array of `ProjectFile` objects
 *
 * Recursively finds all files that are part of the current project, including those that are ignored by .claspignore
 *
 * > Note: content for each file is not returned. Use `getContentOfProjectFiles()` on the resulting array.
 *
 * @param rootDir the project's `rootDir`
 */
export const getAllProjectFiles = async (rootDir = path.join('.', '/')) => {
    try {
        const ignorePatterns = await DOTFILE.IGNORE();
        const isIgnored = (file) => multimatch(path.relative(rootDir, file), ignorePatterns, { dot: true }).length > 0;
        const isValid = isValidFactory(rootDir);
        // Read all filenames as a flattened tree
        // Note: filePaths contain relative paths such as "test/bar.ts", "../../src/foo.js"
        const files = (await recursive(rootDir)).map((filename) => {
            // Replace OS specific path separator to common '/' char for console output
            const name = filename.replace(/\\/g, '/');
            return { source: '', isIgnored: isIgnored(name), name, type: '' };
        });
        files.sort((a, b) => a.name.localeCompare(b.name));
        const filesWithContent = await getContentOfProjectFiles(files);
        return filesWithContent.map((file) => {
            // Loop through files that are not ignored from `.claspignore`
            if (!file.isIgnored) {
                // Prevent node_modules/@types/
                if (file.name.includes('node_modules/@types')) {
                    return ignoredProjectFile(file);
                }
                // Check if there are files that will conflict if renamed .gs to .js.
                // When pushing to Apps Script, these files will overwrite each other.
                const parsed = path.parse(file.name);
                if (parsed.ext === '.gs') {
                    const jsFile = `${parsed.dir}/${parsed.name}.js`;
                    // Can't rename, conflicting files
                    // Only print error once (for .gs)
                    if (files.findIndex(otherFile => !otherFile.isIgnored && otherFile.name === jsFile) !== -1) {
                        throw new ClaspError(ERROR.CONFLICTING_FILE_EXTENSION(`${parsed.dir}/${parsed.name}`));
                    }
                }
                return isValid(file) ? file : ignoredProjectFile(file);
            }
            return file;
        });
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        // TODO improve error handling
        throw error;
    }
};
export const splitProjectFiles = (files) => [
    files.filter(file => !file.isIgnored),
    files.filter(file => file.isIgnored),
];
async function getContentOfProjectFiles(files) {
    const transpileOpttions = getTranspileOptions();
    const getContent = (file) => (file.isIgnored ? file : projectFileWithContent(file, transpileOpttions));
    return Promise.all(files.map(getContent));
}
async function getAppsScriptFilesFromProjectFiles(files, rootDir) {
    const filesWithContent = await getContentOfProjectFiles(files);
    return filesWithContent.map(file => {
        const { name, source, type } = file;
        return {
            name: getAppsScriptFileName(rootDir, name),
            source,
            type, // The file extension
        };
    });
}
// This statement customizes the order in which the files are pushed.
// It puts the files in the setting's filePushOrder first.
// This is needed because Apps Script blindly executes files in order of creation time.
// The Apps Script API updates the creation time of files.
export const getOrderedProjectFiles = (files, filePushOrder) => {
    const orderedFiles = [...files];
    if (filePushOrder && filePushOrder.length > 0) {
        // stopSpinner();
        console.log('Detected filePushOrder setting. Pushing these files first:');
        logFileList(filePushOrder);
        console.log('');
        orderedFiles.sort((a, b) => {
            // Get the file order index
            const indexA = filePushOrder.indexOf(a.name);
            const indexB = filePushOrder.indexOf(b.name);
            // If a file path isn't in the filePushOrder array, set the order to +∞.
            return (indexA > -1 ? indexA : Number.POSITIVE_INFINITY) - (indexB > -1 ? indexB : Number.POSITIVE_INFINITY);
        });
    }
    return orderedFiles;
};
// // Used to receive files tracked by current project
// type FilesCallback = (error: Error | boolean, result: [string[], string[]], files: Array<AppsScriptFile>) => void;
/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/File#FileType
 */
export const getLocalFileType = (type, fileExtension) => type === 'SERVER_JS' ? fileExtension !== null && fileExtension !== void 0 ? fileExtension : 'js' : type.toLowerCase();
/**
 * Returns true if the user has a clasp project.
 * @returns {boolean} If .clasp.json exists.
 */
export const hasProject = () => config.projectConfig !== undefined && fs.existsSync(config.projectConfig);
/**
 * Returns in tsconfig.json.
 * @returns {TranspileOptions} if tsconfig.json not exists, return an empty object.
 */
const getTranspileOptions = () => {
    const tsconfigPath = path.join(config.projectRootDirectory, 'tsconfig.json');
    return fs.existsSync(tsconfigPath)
        ? {
            compilerOptions: parseConfigFileTextToJson(tsconfigPath, fs.readFileSync(tsconfigPath, FS_OPTIONS)).config
                .compilerOptions,
        }
        : {};
};
// /**
//  * Recursively finds all files that are part of the current project, and those that are ignored
//  * by .claspignore and calls the passed callback function with the file lists.
//  * @param {string} rootDir The project's root directory
//  * @param {FilesCallBack} callback The callback will be called with the following paramters
//  *   error: Error if there's an error, otherwise null
//  *   result: string[][], array of two lists of strings, ie. [validFilePaths,ignoredFilePaths]
//  *   files?: Array<AppsScriptFile> Array of AppsScriptFile objects used by clasp push
//  * @todo Make this function actually return a Promise that can be awaited.
//  */
// export const getProjectFiles = async (rootDir: string = path.join('.', '/'), callback: FilesCallback) => {
//   try {
//     const {filePushOrder} = await getProjectSettings();
//     const allFiles = await getAllProjectFiles(rootDir);
//     const [filesToPush, filesToIgnore] = splitProjectFiles(allFiles);
//     const orderedFiles = getOrderedProjectFiles(filesToPush, filePushOrder);
//     callback(
//       false,
//       [orderedFiles.map(file => file.name), filesToIgnore.map(file => file.name)],
//       getAppsScriptFilesFromProjectFiles(orderedFiles, rootDir)
//     );
//   } catch (error) {
//     return callback(error, [[], []], []);
//   }
// };
/**
 * @deprecated If the file is valid, add it to our file list.
 * We generally want to allow for all file types, including files in node_modules/.
 * However, node_modules/@types/ files should be ignored.
 */
export const isValidFileName = (name, type, rootDir, _normalizedName, ignoreMatches) => {
    const isValid = isValidFactory(rootDir);
    return Boolean(!name.includes('node_modules/@types') && // Prevent node_modules/@types/
        isValid({ source: '', isIgnored: false, name, type }) &&
        !ignoreMatches.includes(name) // Must be SERVER_JS or HTML. https://developers.google.com/apps-script/api/reference/rest/v1/File
    );
};
/**
 * Gets the name of the file for Apps Script.
 * Formats rootDir/appsscript.json to appsscript.json.
 * Preserves subdirectory names in rootDir
 * (rootDir/foo/Code.js becomes foo/Code.js)
 * @param {string} rootDir The directory to save the project files to.
 * @param {string} filePath Path of file that is part of the current project
 */
export const getAppsScriptFileName = (rootDir, filePath) => {
    const nameWithoutExt = filePath.slice(0, -path.extname(filePath).length);
    // Replace OS specific path separator to common '/' char
    return (rootDir ? path.relative(rootDir, nameWithoutExt) : nameWithoutExt).replace(/\\/g, '/');
};
/**
 * Fetches the files for a project from the server
 * @param {string} scriptId The project script id
 * @param {number?} versionNumber The version of files to fetch.
 * @returns {AppsScriptFile[]} Fetched files
 */
export const fetchProject = async (scriptId, versionNumber, silent = false) => {
    await loadAPICredentials();
    spinner.start();
    let response;
    try {
        response = await script.projects.getContent({ scriptId, versionNumber });
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        if (error.statusCode === 404) {
            throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
        }
        throw new ClaspError(`${ERROR.SCRIPT_ID}:${error}`);
    }
    stopSpinner();
    const { files } = response.data;
    if (!files) {
        throw new ClaspError(ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }
    if (!silent) {
        console.log(LOG.CLONE_SUCCESS(files.length));
    }
    return files;
};
/**
 * Writes files locally to `pwd` with dots converted to subdirectories.
 * @param {AppsScriptFile[]} Files to wirte
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 */
export const writeProjectFiles = async (files, rootDir = '') => {
    var _a;
    try {
        const { fileExtension } = await getProjectSettings();
        const mapper = async (file) => {
            var _a;
            const filePath = `${file.name}.${getLocalFileType(file.type, fileExtension)}`;
            const truePath = `${rootDir || '.'}/${filePath}`;
            try {
                await makeDir(path.dirname(truePath));
                await fs.writeFile(truePath, file.source);
            }
            catch (error) {
                throw new ClaspError((_a = getErrorMessage(error)) !== null && _a !== void 0 ? _a : ERROR.FS_FILE_WRITE);
            }
            // Log only filename if pulling to root (Code.gs vs ./Code.gs)
            console.log(`└─ ${rootDir ? truePath : filePath}`);
        };
        const fileList = files.filter(file => file.source); // Disallow empty files
        fileList.sort((a, b) => a.name.localeCompare(b.name));
        await pMap(fileList, mapper);
    }
    catch (error) {
        if (error instanceof ClaspError) {
            throw error;
        }
        throw new ClaspError((_a = getErrorMessage(error)) !== null && _a !== void 0 ? _a : ERROR.FS_DIR_WRITE);
    }
};
/**
 * Pushes project files to script.google.com.
 * @param {boolean} silent If true, doesn't console.log any success message.
 */
export const pushFiles = async (silent = false) => {
    const { filePushOrder, scriptId, rootDir } = await getProjectSettings();
    if (scriptId) {
        const [toPush] = splitProjectFiles(await getAllProjectFiles(rootDir));
        if (toPush.length > 0) {
            const orderedFiles = getOrderedProjectFiles(toPush, filePushOrder);
            const files = await getAppsScriptFilesFromProjectFiles(orderedFiles, rootDir !== null && rootDir !== void 0 ? rootDir : path.join('.', '/'));
            const filenames = orderedFiles.map(file => file.name);
            // Start pushing.
            try {
                await script.projects.updateContent({ scriptId, requestBody: { scriptId, files } });
                // No error
                if (!silent) {
                    logFileList(filenames);
                    console.log(LOG.PUSH_SUCCESS(filenames.length));
                }
            }
            catch (error) {
                console.error(LOG.PUSH_FAILURE);
                console.error(error);
                throw error;
            }
            finally {
                stopSpinner();
            }
        }
        else {
            stopSpinner();
            console.log(LOG.PUSH_NO_FILES);
        }
    }
};
export const logFileList = (files) => console.log(files.map(file => `└─ ${file}`).join('\n'));
//# sourceMappingURL=files.js.map