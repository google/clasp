/**
 * Checks if the rootDir appears to be a valid project.
 *
 * @param {string} rootDir dir to check.
 *
 * @return {boolean} True if valid project, false otherwise
 */
export declare const manifestExists: (rootDir?: string | undefined) => boolean;
/**
 * Reads the appsscript.json manifest file.
 * @returns {Promise<Manifest>} A promise to get the manifest file as object.
 * @see https://developers.google.com/apps-script/concepts/manifests
 */
export declare const readManifest: () => Promise<Manifest>;
/**
 * Returns true if the manifest is valid.
 */
export declare const isValidManifest: (manifest?: Manifest | undefined) => Promise<boolean>;
/**
 * Ensures the manifest is correct for running a function.
 * The manifest must include:
 * "executionApi": {
 *   "access": "MYSELF"
 * }
 */
export declare const isValidRunManifest: () => Promise<boolean>;
/**
 * Reads manifest file from project root dir.
 * The manifest is valid if it:
 * - It exists in the project root.
 * - Is valid JSON.
 */
export declare const getManifest: () => Promise<Manifest>;
/**
 * Adds a list of scopes to the manifest.
 * @param {string[]} scopes The list of explicit scopes
 */
export declare const addScopeToManifest: (scopes: readonly string[]) => Promise<void>;
/**
 * Enables or disables an advanced service in the manifest.
 * @param serviceId {string} The id of the service that should be enabled or disabled.
 * @param enable {boolean} True if you want to enable a service. Disables otherwise.
 * @see PUBLIC_ADVANCED_SERVICES
 */
export declare const enableOrDisableAdvanceServiceInManifest: (serviceId: string, enable: boolean) => Promise<void>;
interface EnabledAdvancedService {
    userSymbol: string;
    serviceId: string;
    version: string;
}
interface Library {
    userSymbol: string;
    libraryId: string;
    version: string;
    developmentMode: boolean;
}
interface Dependencies {
    enabledAdvancedServices?: EnabledAdvancedService[];
    libraries?: Library[];
}
interface Webapp {
    access: string;
    executeAs: string;
}
interface ExecutionApi {
    access: string;
}
interface Unconditional {
}
interface ContextualTrigger {
    unconditional: Unconditional;
    onTriggerFunction: string;
}
interface SelectAction {
    text: string;
    runFunction: string;
}
interface ComposeTrigger {
    selectActions: SelectAction[];
    draftAccess: string;
}
interface UniversalAction {
    text: string;
    runFunction: string;
    openLink: string;
}
interface Gmail2 {
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    authorizationCheckFunction: string;
    contextualTriggers: ContextualTrigger[];
    composeTrigger: ComposeTrigger;
    openLinkUrlPrefixes: string[];
    universalActions: UniversalAction[];
    useLocaleFromApp: boolean;
}
interface Macro {
    menuName: string;
    functionName: string;
    defaultShortcut: string;
}
interface Sheets {
    macros: Macro[];
}
interface Gmail {
    oauthScopes: string[];
    urlFetchWhitelist: string[];
    gmail: Gmail2;
    sheets: Sheets;
}
interface Manifest {
    timeZone?: string;
    oauthScopes?: string[];
    dependencies?: Dependencies;
    exceptionLogging?: string;
    webapp?: Webapp;
    executionApi?: ExecutionApi;
    urlFetchWhitelist?: string[];
    gmail?: Gmail;
}
export {};
