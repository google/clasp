interface CommandOption {
    readonly open?: string;
}
declare const _default: (options: CommandOption) => Promise<void>;
/**
 * Acts as a router to apis subcommands
 * Calls functions for list, enable, or disable
 * Otherwise returns an error of command not supported
 */
export default _default;
