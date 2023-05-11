interface CommandOption {
    readonly nondev: boolean;
    readonly params: string;
}
declare const _default: (functionName: string, options: CommandOption) => Promise<void>;
/**
 * Executes an Apps Script function. Requires clasp login --creds.
 * @param functionName {string} The function name within the Apps Script project.
 * @param options.nondev {boolean} If we want to run the last deployed version vs the latest code.
 * @param options.params {string} JSON string of parameters to be input to function.
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 * @requires `clasp login --creds` to be run beforehand.
 */
export default _default;
