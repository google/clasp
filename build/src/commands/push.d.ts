interface CommandOption {
    readonly watch?: boolean;
    readonly force?: boolean;
}
declare const _default: (options: CommandOption) => Promise<void>;
/**
 * Uploads all files into the script.google.com filesystem.
 * TODO: Only push the specific files that changed (rather than all files).
 * @param options.watch {boolean} If true, runs `clasp push` when any local file changes. Exit with ^C.
 */
export default _default;
