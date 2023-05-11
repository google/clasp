interface CommandOption {
    readonly json?: boolean;
}
declare const _default: ({ json }?: CommandOption) => Promise<void>;
/**
 * Displays the status of which Apps Script files are ignored from .claspignore
 * @param options.json {boolean} Displays the status in json format.
 */
export default _default;
