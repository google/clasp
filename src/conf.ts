import * as os from 'os';
import * as path from 'path';
import { VirtualFile } from './virtualfile';

/**
 * supported environment variables
 */
enum ENV {
  DOT_CLASP_AUTH = 'clasp_config_project',
  DOT_CLASP_IGNORE = 'clasp_config_ignore',
  DOT_CLASP_PROJECT = 'clasp_config_project',
  MANIFEST = 'clasp_config_manifest',
  // TSCONFIG = 'clasp_config_tsconfig',
}

// Names / Paths
export const PROJECT_NAME = 'clasp';
export const PROJECT_MANIFEST_BASENAME = 'appsscript';
export const PROJECT_MANIFEST_FILENAME = `${PROJECT_MANIFEST_BASENAME}.json`;

/**
 * The Singleton class defines the `getInstance` method that lets clients access
 * the unique singleton instance.
 */
export class Conf {
  private static _instance: Conf;
  project: VirtualFile;
  ignore: VirtualFile;
  auth: VirtualFile;
  manifest: VirtualFile;

  /**
   * constructor should be private to prevent direct construction calls with the `new` operator.
   */
  private constructor() {

    /**
     * Helper to set the VirtualFile path if environment variables is set.
     *
     * Note: Empty value (i.e. '') is not accounted for
     */
    const setPathWithEnvVar = (varName: string, file: VirtualFile) => {
      const envVar = process.env[varName];
      if (envVar) {
        file.path = envVar;
      }
    };

    this.project = new VirtualFile({ dir: '.', base: `.${PROJECT_NAME}.json` });
    // IgnoreFile class implements a custom .resolve()vlogic
    this.ignore = new IgnoreFile({ dir: os.homedir(), base: `.${PROJECT_NAME}ignore` });
    // Default Auth is global. Any other implies local auth
    this.auth = new VirtualFile({ dir: os.homedir(), base: `.${PROJECT_NAME}rc.json` });
    this.manifest = new VirtualFile({ dir: '.', base: PROJECT_MANIFEST_FILENAME });

    // resolve environment variables

    setPathWithEnvVar(ENV.DOT_CLASP_PROJECT, this.project);
    setPathWithEnvVar(ENV.DOT_CLASP_IGNORE, this.ignore);
    setPathWithEnvVar(ENV.DOT_CLASP_AUTH, this.auth);
    setPathWithEnvVar(ENV.MANIFEST, this.manifest);
  }

  /**
   * The static method that controls the access to the Config singleton instance.
   */
  static get(): Conf {
    if (!Conf._instance) {
      Conf._instance = new Conf();
    }

    return Conf._instance;
  }
}

class IgnoreFile extends VirtualFile {
  /**
   * Attempts to resolve the current active path:
   *
   * - if default path, lookup for default base filename in the project (`.clasp.json`) directory
   * - otherwise use super.resolve()
   */
  resolve() {
    if (this.isDefault()) {
      const dir = path.dirname(Conf.get().project.resolve());
      return path.join(dir, this._defaultPath.base);
    }
    return super.resolve();
  }
}

// TODO: add more subclasses if necessary
