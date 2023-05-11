interface AppsScriptFile {
    readonly name: string;
    readonly source: string;
    readonly type: string;
}
interface ProjectFile {
    readonly isIgnored: boolean;
    readonly name: string;
    readonly source: string;
    readonly type: string;
}
/**
 * Return an array of `ProjectFile` objects
 *
 * Recursively finds all files that are part of the current project, including those that are ignored by .claspignore
 *
 * > Note: content for each file is not returned. Use `getContentOfProjectFiles()` on the resulting array.
 *
 * @param rootDir the project's `rootDir`
 */
export declare const getAllProjectFiles: (rootDir?: string) => Promise<ProjectFile[]>;
export declare const splitProjectFiles: (files: ProjectFile[]) => [ProjectFile[], ProjectFile[]];
export declare const getOrderedProjectFiles: (files: ProjectFile[], filePushOrder: string[] | undefined) => ProjectFile[];
/**
 * Gets the local file type from the API FileType.
 * @param  {string} type The file type returned by Apps Script
 * @return {string}      The file type
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/File#FileType
 */
export declare const getLocalFileType: (type: string, fileExtension?: string | undefined) => string;
/**
 * Returns true if the user has a clasp project.
 * @returns {boolean} If .clasp.json exists.
 */
export declare const hasProject: () => boolean;
/**
 * @deprecated If the file is valid, add it to our file list.
 * We generally want to allow for all file types, including files in node_modules/.
 * However, node_modules/@types/ files should be ignored.
 */
export declare const isValidFileName: (name: string, type: string, rootDir: string, _normalizedName: string, ignoreMatches: readonly string[]) => boolean;
/**
 * Gets the name of the file for Apps Script.
 * Formats rootDir/appsscript.json to appsscript.json.
 * Preserves subdirectory names in rootDir
 * (rootDir/foo/Code.js becomes foo/Code.js)
 * @param {string} rootDir The directory to save the project files to.
 * @param {string} filePath Path of file that is part of the current project
 */
export declare const getAppsScriptFileName: (rootDir: string, filePath: string) => string;
/**
 * Fetches the files for a project from the server
 * @param {string} scriptId The project script id
 * @param {number?} versionNumber The version of files to fetch.
 * @returns {AppsScriptFile[]} Fetched files
 */
export declare const fetchProject: (scriptId: string, versionNumber?: number | undefined, silent?: boolean) => Promise<AppsScriptFile[]>;
/**
 * Writes files locally to `pwd` with dots converted to subdirectories.
 * @param {AppsScriptFile[]} Files to wirte
 * @param {string?} rootDir The directory to save the project files to. Defaults to `pwd`
 */
export declare const writeProjectFiles: (files: AppsScriptFile[], rootDir?: string) => Promise<void>;
/**
 * Pushes project files to script.google.com.
 * @param {boolean} silent If true, doesn't console.log any success message.
 */
export declare const pushFiles: (silent?: boolean) => Promise<void>;
export declare const logFileList: (files: readonly string[]) => void;
export {};
