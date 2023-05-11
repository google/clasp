import os from 'os';
import path from 'path';
import { findUpSync } from 'find-up';
import { PROJECT_NAME } from './constants.js';
/**
 * Supported environment variables
 */
var ENV;
(function (ENV) {
    ENV["DOT_CLASP_AUTH"] = "clasp_config_auth";
    ENV["DOT_CLASP_IGNORE"] = "clasp_config_ignore";
    ENV["DOT_CLASP_PROJECT"] = "clasp_config_project";
    // MANIFEST = 'clasp_config_manifest',
    // TSCONFIG = 'clasp_config_tsconfig',
})(ENV || (ENV = {}));
/**
 * A Singleton class to hold configuration related objects.
 * Use the `get()` method to access the unique singleton instance.
 *
 * Resolution order for paths is:
 * - Explicitly set paths (via CLI option)
 * - Env var
 * - Well-known location
 *
 *
 */
export class Conf {
    /**
     * Private to prevent direct construction calls with the `new` operator.
     */
    constructor() { }
    set projectRootDirectory(path) {
        this._root = path;
        this._projectConfig = undefined; // Force recalculation of path if root chanaged
    }
    get projectRootDirectory() {
        if (this._root === undefined) {
            const configPath = findUpSync(`.${PROJECT_NAME}.json`);
            this._root = configPath ? path.dirname(configPath) : process.cwd();
        }
        return this._root;
    }
    set projectConfig(filePath) {
        this._projectConfig = filePath;
        if (filePath) {
            this._root = path.dirname(filePath); // Root dir must be same dir as config
        }
    }
    get projectConfig() {
        if (this._projectConfig === undefined && this.projectRootDirectory) {
            this._projectConfig = this.buildPathOrUseEnv(`.${PROJECT_NAME}.json`, this.projectRootDirectory, ENV.DOT_CLASP_PROJECT);
        }
        return this._projectConfig;
    }
    set ignore(path) {
        this._ignore = path;
    }
    get ignore() {
        if (this._ignore === undefined && this.projectRootDirectory) {
            this._ignore = this.buildPathOrUseEnv(`.${PROJECT_NAME}ignore`, this.projectRootDirectory, ENV.DOT_CLASP_IGNORE);
        }
        return this._ignore;
    }
    set auth(path) {
        this._auth = path;
    }
    get auth() {
        if (this._auth === undefined) {
            this._auth = this.buildPathOrUseEnv(`.${PROJECT_NAME}rc.json`, os.homedir(), ENV.DOT_CLASP_AUTH);
        }
        return this._auth;
    }
    set authLocal(path) {
        this._authLocal = path;
    }
    get authLocal() {
        if (this._authLocal === undefined && this.projectRootDirectory) {
            this._authLocal = this.buildPathOrUseEnv(`.${PROJECT_NAME}rc.json`, this.projectRootDirectory, ENV.DOT_CLASP_AUTH);
        }
        return this._authLocal;
    }
    buildPathOrUseEnv(filename, root, envName) {
        if (envName && process.env[envName] !== undefined) {
            return process.env[envName];
        }
        return path.join(root, filename);
    }
    /**
     * The static method that controls the access to the Conf singleton instance.
     *
     * @returns {Conf}
     */
    static get() {
        if (!Conf._instance) {
            Conf._instance = new Conf();
        }
        return Conf._instance;
    }
}
//# sourceMappingURL=conf.js.map