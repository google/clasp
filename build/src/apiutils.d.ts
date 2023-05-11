import { script_v1 as scriptV1 } from 'googleapis';
import type { ReadonlyDeep } from 'type-fest';
/**
 * Prompts for the function name.
 */
export declare const getFunctionNames: (script: ReadonlyDeep<scriptV1.Script>, scriptId: string) => Promise<string>;
/**
 * Enables or disables a Google API.
 * @param {string} serviceName The name of the service. i.e. sheets
 * @param {boolean} enable Enables the API if true, otherwise disables.
 */
export declare const enableOrDisableAPI: (serviceName: string, enable: boolean) => Promise<void>;
/**
 * Enable 'script.googleapis.com' of Google API.
 */
export declare const enableAppsScriptAPI: () => Promise<void>;
