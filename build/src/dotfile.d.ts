import type { Auth } from 'googleapis';
export type { Dotfile } from 'dotf';
export interface ProjectSettings {
    scriptId: string;
    rootDir?: string;
    projectId?: string;
    fileExtension?: string;
    filePushOrder?: string[];
    parentId?: string[];
}
export declare const DOTFILE: {
    /**
     * Reads ignore.resolve() to get a glob pattern of ignored paths.
     * @return {Promise<string[]>} A list of file glob patterns
     */
    IGNORE: () => Promise<string[]>;
    /**
     * Gets the closest DOT.PROJECT.NAME in the parent directory of the directory
     * that the command was run in.
     * @return {Dotf} A dotf with that dotfile. Null if there is no file
     */
    PROJECT: () => import("dotf").Dotfile;
    AUTH: (local?: boolean | undefined) => import("dotf").Dotfile;
};
/**
 * OAuth client settings file.
 * Local credentials are saved in ./.clasprc.json
 * Global credentials are saved in ~/.clasprc.json
 * @example
 * {
 *   "token": {
 *     "access_token": "",
 *     "refresh_token": "",
 *     "scope": "https://www.googleapis.com/auth/script.projects https://.../script.webapp.deploy",
 *     "token_type": "Bearer",
 *     "expiry_date": 1539130731398
 *   },
 *   "oauth2ClientSettings": {
 *     "clientId": "",
 *     "clientSecret": "",
 *     "redirectUri": "http://localhost"
 *   },
 *   "isLocalCreds": false
 * }
 */
export interface ClaspToken {
    token: Auth.Credentials;
    oauth2ClientSettings: Auth.OAuth2ClientOptions;
    isLocalCreds: boolean;
}
