interface CommandOption {
    readonly json?: boolean;
    readonly open?: boolean;
    readonly setup?: boolean;
    readonly watch?: boolean;
    readonly simplified?: boolean;
}
declare const _default: (options: CommandOption) => Promise<void>;
/**
 * Prints StackDriver logs from this Apps Script project.
 * @param options.json {boolean} If true, the command will output logs as json.
 * @param options.open {boolean} If true, the command will open the StackDriver logs website.
 * @param options.setup {boolean} If true, the command will help you setup logs.
 * @param options.watch {boolean} If true, the command will watch for logs and print them. Exit with ^C.
 * @param options.simplified {boolean} If true, the command will remove timestamps from the logs.
 */
export default _default;
