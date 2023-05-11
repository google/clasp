interface CommandOption {
    readonly all?: boolean;
}
declare const _default: (deploymentId: string | undefined, options: CommandOption) => Promise<void>;
/**
 * Removes a deployment from the Apps Script project.
 * @param deploymentId {string} The deployment's ID
 */
export default _default;
