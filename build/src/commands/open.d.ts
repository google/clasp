interface CommandOption {
    readonly webapp?: boolean;
    readonly creds?: boolean;
    readonly addon?: boolean;
    readonly deploymentId?: string;
}
declare const _default: (scriptId: string, options: CommandOption) => Promise<void>;
/**
 * Opens an Apps Script project's script.google.com editor.
 * @param scriptId {string} The Apps Script project to open.
 * @param options.webapp {boolean} If true, the command will open the webapps URL.
 * @param options.creds {boolean} If true, the command will open the credentials URL.
 * @param options.deploymentId {string} Use custom deployment ID with webapp.
 */
export default _default;
