interface CommandOption {
    readonly versionNumber?: number;
    readonly description?: string;
    readonly deploymentId?: string;
}
declare const _default: (options: CommandOption) => Promise<void>;
/**
 * Deploys an Apps Script project.
 * @param options.versionNumber {string} The project version to deploy at.
 * @param options.description   {string} The deployment description.
 * @param options.deploymentId  {string} The deployment ID to redeploy.
 */
export default _default;
