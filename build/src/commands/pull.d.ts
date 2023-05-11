interface CommandOption {
    readonly versionNumber?: number;
}
declare const _default: (options: CommandOption) => Promise<void>;
/**
 * Force downloads all Apps Script project files into the local filesystem.
 * @param options.versionNumber {number} The version number of the project to retrieve.
 *                              If not provided, the project's HEAD version is returned.
 */
export default _default;
