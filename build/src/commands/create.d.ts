interface CommandOption {
    readonly parentId?: string;
    readonly rootDir?: string;
    readonly title?: string;
    readonly type?: string;
}
declare const _default: (options: CommandOption) => Promise<void>;
/**
 * Creates a new Apps Script project.
 * @param options.type {string} The type of the Apps Script project.
 * @param options.title {string} The title of the Apps Script project's file
 * @param options.parentId {string} The Drive ID of the G Suite doc this script is bound to.
 * @param options.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                        If not specified, clasp will default to the current directory.
 */
export default _default;
