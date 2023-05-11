interface CommandOption {
    readonly rootDir: string;
}
declare const _default: (scriptId: string | undefined, versionNumber: number | undefined, options: CommandOption) => Promise<void>;
/**
 * Fetches an Apps Script project.
 * Prompts the user if no script ID is provided.
 * @param scriptId {string} The Apps Script project ID or project URL to fetch.
 * @param versionNumber {string} An optional version to pull the script from.
 * @param options.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                        If not specified, clasp will default to the current directory.
 */
export default _default;
