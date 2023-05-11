import { script_v1 as scriptV1, Auth } from 'googleapis';
import type { ClaspToken } from './dotfile';
import type { ClaspCredentials } from './utils';
export declare const discovery: import("googleapis").discovery_v1.Discovery;
export declare const drive: import("googleapis").drive_v3.Drive;
export declare const logger: import("googleapis").logging_v2.Logging;
export declare const script: scriptV1.Script;
export declare const serviceUsage: import("googleapis").serviceusage_v1.Serviceusage;
/**
 * Gets the local OAuth client for the Google Apps Script API.
 * Only the Apps Script API needs to use local credential for the Execution API (script.run).
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 */
export declare const getLocalScript: () => Promise<scriptV1.Script>;
export declare const scopeWebAppDeploy = "https://www.googleapis.com/auth/script.webapp.deploy";
export declare const defaultScopes: string[];
/**
 * @param {boolean} useLocalhost Uses a local HTTP server if true. Manual entry o.w.
 * @param {ClaspCredentials?} creds An optional credentials object.
 * @param {string[]} [scopes=[]] List of OAuth scopes to authorize.
 */
interface AuthorizationOptions {
    readonly creds?: Readonly<ClaspCredentials>;
    readonly scopes: readonly string[];
    readonly useLocalhost: boolean;
}
/**
 * Requests authorization to manage Apps Script projects.
 */
export declare const authorize: (options: AuthorizationOptions) => Promise<void | Auth.JWT>;
export declare const getLoggedInEmail: () => Promise<string | null | undefined>;
/**
 * Loads the Apps Script API credentials for the CLI.
 *
 * Required before every API call.
 */
export declare const loadAPICredentials: (local?: boolean) => Promise<ClaspToken>;
export {};
