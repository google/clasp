import { script_v1 as scriptV1, Auth } from 'googleapis';
import type { ClaspToken, ProjectSettings } from './dotfile';
/**
 * The installed credentials. This is a file downloaded from console.developers.google.com
 * Credentials > OAuth 2.0 client IDs > Type:Other > Download
 * Usually called: creds.json
 * @see https://console.developers.google.com/apis/credentials
 */
interface ClaspCredentialsInstalled {
    client_id: string;
    project_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_secret: string;
    redirect_uris: string[];
}
export interface ClaspOauthCredentials {
    installed: ClaspCredentialsInstalled;
}
export declare type ClaspCredentials = ClaspOauthCredentials | Auth.JWTInput;
/**
 * Checks if OAuth client settings rc file exists.
 * @param  {boolean} local check ./clasprc.json instead of ~/.clasprc.json
 * @return {boolean}
 */
export declare const hasOauthClientSettings: (local?: boolean) => boolean;
/**
 * Gets the OAuth client settings from rc file.
 * @param {boolean} local If true, gets the local OAuth settings. Global otherwise.
 * ! Should be used instead of `DOTFILE.RC?().read()`
 * @returns {Promise<ClaspToken>} A promise to get the rc file as object.
 */
export declare const getOAuthSettings: (local: boolean) => Promise<ClaspToken>;
export declare const spinner: import("ora").Ora;
/** Stops the spinner if it is spinning */
export declare const stopSpinner: () => void;
export declare const getErrorMessage: (value: any) => any;
/**
 * Gets the web application URL from a deployment.
 *
 * It is too expensive to get the web application URL from the Drive API. (Async/not offline)
 * @param  {any} value The deployment
 * @return {string}          The URL of the web application in the online script editor.
 */
export declare const getWebApplicationURL: (value: Readonly<scriptV1.Schema$Deployment>) => string | null | undefined;
/**
 * Gets default project name.
 * @return {string} default project name.
 */
export declare const getDefaultProjectName: () => string;
/**
 * Gets the project settings from the project dotfile.
 *
 * Logs errors.
 *
 * ! Should be used instead of `DOTFILE.PROJECT().read()`
 * @return {Promise<ProjectSettings>} A promise to get the project dotfile as object.
 */
export declare const getProjectSettings: () => Promise<ProjectSettings>;
/**
 * Gets the Google Drive API FileType.
 *
 * Assumes the path is valid.
 * @param  {string} value  The file path
 * @return {string}           The API's FileType enum (uppercase), null if not valid.
 */
export declare const getApiFileType: (value: string) => string;
/**
 * Checks if the network is available. Gracefully exits if not.
 */
export declare const safeIsOnline: () => Promise<boolean>;
/**
 * Checks if the network is available. Gracefully exits if not.
 */
export declare const checkIfOnlineOrDie: () => Promise<boolean>;
/**
 * Saves the project settings in the project dotfile.
 * @param {ProjectSettings} projectSettings The project settings
 * @param {boolean} append Appends the settings if true.
 */
export declare const saveProject: (projectSettings: ProjectSettings, append?: boolean) => Promise<ProjectSettings>;
/**
 * Gets the script's Cloud Platform Project Id from project settings file or prompt for one.
 * @returns {Promise<string>} A promise to get the projectId string.
 */
export declare const getProjectId: (promptUser?: boolean) => Promise<string>;
/**
 * Validates input string is a well-formed project id.
 * @param {string} value The project id.
 * @returns {boolean} Is the project id valid
 */
export declare const isValidProjectId: (value: string) => boolean;
/**
 * Parses input string into a valid JSON object or throws a `ClaspError` error.
 * @param value JSON string.
 */
export declare const parseJsonOrDie: <T>(value: string) => T;
/**
 * Pads input string to given length and truncate with ellipsis if necessary
 */
export declare const ellipsize: (value: string, length: number) => string;
export {};
