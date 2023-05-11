interface CommandOption {
    readonly localhost?: boolean;
    readonly creds?: string;
    readonly status?: boolean;
}
declare const _default: (options: CommandOption) => Promise<void>;
/**
 * Logs the user in. Saves the client credentials to an either local or global rc file.
 * @param {object} options The login options.
 * @param {boolean?} options.localhost If true, authorizes without a HTTP server.
 * @param {string?} options.creds The location of credentials file.
 * @param {boolean?} options.status If true, prints who is logged in instead of doing login.
 */
export default _default;
