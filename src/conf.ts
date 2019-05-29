import * as os from 'os';
import * as path from 'path';
import { VirtualFile } from './virtualfile';

/**
 * supported environment variables
 */
enum ENV {
  DOT_CLASP_AUTH = 'clasp_config_auth',
  DOT_CLASP_IGNORE = 'clasp_config_ignore',
  DOT_CLASP_PROJECT = 'clasp_config_project',
  // MANIFEST = 'clasp_config_manifest',
  // TSCONFIG = 'clasp_config_tsconfig',
}

// Names / Paths
/** Constant `clasp` */
export const PROJECT_NAME = 'clasp';
/** Constant `appsscript` */
export const PROJECT_MANIFEST_BASENAME = 'appsscript';
/** Constant `appsscript.json` */
export const PROJECT_MANIFEST_FILENAME = `${PROJECT_MANIFEST_BASENAME}.json`;

/**
 * A Singleton class to hold configuration related objects.
 * Use the `get()` method to access the unique singleton instance.
 */
export class Conf {
  private static _instance: Conf;
  readonly project: VirtualFile;
  readonly ignore: VirtualFile;
  readonly auth: VirtualFile;
  readonly manifest: VirtualFile;

  /**
   * Private to prevent direct construction calls with the `new` operator.
   */
  private constructor() {

    /**
     * Helper to set the VirtualFile path if an environment variables is set.
     *
     * *Note: Empty values (i.e. '') are not accounted for.*
     */
    const setPathWithEnvVar = (varName: string, file: VirtualFile) => {
      const envVar = process.env[varName];
      if (envVar) {
        file.path = envVar;
      }
    };

    this.project = new VirtualFile({ dir: '.', base: `.${PROJECT_NAME}.json` });
    // IgnoreFile class implements a custom `.resolve()` logic
    this.ignore = new IgnoreFile({ dir: os.homedir(), base: `.${PROJECT_NAME}ignore` });
    // Default Auth is global. Any other implies local auth
    this.auth = new AuthFile({ dir: os.homedir(), base: `.${PROJECT_NAME}rc.json` });
    // this.manifest = new VirtualFile({ dir: '.', base: PROJECT_MANIFEST_FILENAME });

    // resolve environment variables
    setPathWithEnvVar(ENV.DOT_CLASP_PROJECT, this.project);
    setPathWithEnvVar(ENV.DOT_CLASP_IGNORE, this.ignore);
    setPathWithEnvVar(ENV.DOT_CLASP_AUTH, this.auth);
    // setPathWithEnvVar(ENV.MANIFEST, this.manifest);
  }

  /**
   * The static method that controls the access to the Conf singleton instance.
   *
   * @returns {Conf}
   */
  static get(): Conf {
    if (!Conf._instance) {
      Conf._instance = new Conf();
    }

    return Conf._instance;
  }
}

class AuthFile extends VirtualFile {
  /**
   * Resolves the current active path
   *
   * - if default path, use as is
   * - otherwise use super.resolve()
   *
   * @returns {string}
   */
  resolve() {
    return this.isDefault()
      ? path.join(this._defaultPath.dir, this._defaultPath.base)
      : super.resolve();
  }
}

class IgnoreFile extends VirtualFile {
  /**
   * Resolves the current active path
   *
   * - if default path, assume default base filename in the project (`.clasp.json`) directory
   * - otherwise use super.resolve()
   *
   * @returns {string}
   */
  resolve() {
    return this.isDefault()
      ? path.join(Conf.get().project.resolvedDir, this._defaultPath.base)
      : super.resolve();
  }
}

// TODO: add more subclasses if necessary
