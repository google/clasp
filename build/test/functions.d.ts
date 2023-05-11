/** basic cleanup after tests */
export declare const cleanup: () => void;
/** basic setup for tests */
export declare const setup: () => void;
/** setup for tests not using the run API */
export declare const setupWithoutGCPProject: () => void;
/** setup for tests using the run API */
export declare const setupWithRunManifest: () => void;
/** produce a pseudo random string */
export declare const randomString: () => string;
/**
 * backup clasp settings. Use `restoreSettings()` to restore these.
 */
export declare const backupSettings: () => void;
/**
 * restore clasp settings backuped up using `backupSettings()`
 */
export declare const restoreSettings: () => void;
/**
 * create a temporary directory and its content, then return its path as a string
 *
 * @param {Array<{ file: string, data: string }} filepathsAndContents directory content (files)
 */
export declare function setupTemporaryDirectory(filepathsAndContents: Array<{
    file: string;
    data: string;
}>): string;
