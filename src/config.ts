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
export class Config {
  private static _instance: Config;
  project: VirtualFile;
  ignore: VirtualFile;
  auth: VirtualFile;
  manifest: VirtualFile;

  /**
   * constructor should be private to prevent direct construction calls with the `new` operator.
   */
  private constructor() {
    this.project = new VirtualFile({ dir: '.', base: `.${PROJECT_NAME}.json` });
    // TODO: clarify how .claspignore is resolved
    this.ignore = new IgnoreFile({ dir: os.homedir(), base: `.${PROJECT_NAME}ignore` });
    // TODO: confirm default path implies global RC, else implies local RC
    // this.auth = new VirtualFile({ dir: '.', base: `.${PROJECT_NAME}rc.json` });
    this.auth = new VirtualFile({ dir: os.homedir(), base: `.${PROJECT_NAME}rc.json` });
    this.manifest = new VirtualFile({ dir: '.', base: PROJECT_MANIFEST_FILENAME });

    // resolve environment variables
    const applyEnvVar = (varName: string, file: VirtualFile) => {
      const envVar = process.env[varName];
      if (envVar) {
        file.path = envVar;
      }
    };

    applyEnvVar(ENV.DOT_CLASP_PROJECT, this.project);
    applyEnvVar(ENV.DOT_CLASP_IGNORE, this.ignore);
    applyEnvVar(ENV.DOT_CLASP_AUTH, this.auth);
    applyEnvVar(ENV.MANIFEST, this.manifest);
  }

  /**
   * The static method that controls the access to the Config singleton instance.
   */
  static getInstance(): Config {
    if (!Config._instance) {
      Config._instance = new Config();
    }

    return Config._instance;
  }
}

class IgnoreFile extends VirtualFile {
  /**
   * Attempts to resolve the current active path:
   *
   * - if default path:
   *   - lookup default base filename from project (`.clasp.json`) directory
   *   - lookup default base filename in cwd
   * - use super.resolve()
   */
  resolve() {
    if (this.isDefault()) {
      // TODO: clarify/specify the expected resolution steps
      return path.join(process.cwd(), this._defaultPath.base);
    } else {
      return super.resolve();
    }
    throw new Error(`Unrecognized path ${'pathToResolve'}`);
  }
}

// TODO: add more subclasses if necessary
