import os from 'os';
import path from 'path';

import {PROJECT_NAME} from './constants.js';
import {PathProxy} from './path-proxy.js';

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

/**
 * A Singleton class to hold configuration related objects.
 * Use the `get()` method to access the unique singleton instance.
 */
export class Conf {
  private static _instance: Conf;
  /**
   * This dotfile saves clasp project information, local to project directory.
   */
  readonly project: PathProxy;
  /**
   * This dotfile stores information about ignoring files on `push`. Like .gitignore.
   */
  readonly ignore: IgnoreFile;
  /**
   * This dotfile saves auth information. Should never be committed.
   * There are 2 types: personal & global:
   * - Global: In the $HOME directory.
   * - Personal: In the local directory.
   * @see {ClaspToken}
   */
  readonly auth: AuthFile;
  // readonly manifest: PathProxy;

  /**
   * Private to prevent direct construction calls with the `new` operator.
   */
  private constructor() {
    /**
     * Helper to set the PathProxy path if an environment variables is set.
     *
     * *Note: Empty values (i.e. '') are not accounted for.*
     */
    const setPathWithEnvVar = (varName: string, file: PathProxy) => {
      const envVar = process.env[varName];
      if (envVar) {
        file.path = envVar;
      }
    };

    // default `project` path is `./.clasp.json`
    this.project = new PathProxy({dir: '.', base: `.${PROJECT_NAME}.json`});

    // default `ignore` path is `~/.claspignore`
    // IgnoreFile class implements custom `.resolve()` rules
    this.ignore = new IgnoreFile({dir: os.homedir(), base: `.${PROJECT_NAME}ignore`});

    // default `auth` path is `~/.clasprc.json`
    // Default Auth is global. Any other implies local auth
    this.auth = new AuthFile({dir: os.homedir(), base: `.${PROJECT_NAME}rc.json`});

    // resolve environment variables
    setPathWithEnvVar(ENV.DOT_CLASP_PROJECT, this.project);
    setPathWithEnvVar(ENV.DOT_CLASP_IGNORE, this.ignore);
    setPathWithEnvVar(ENV.DOT_CLASP_AUTH, this.auth);
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

class AuthFile extends PathProxy {
  /**
   * Rules to resolves path:
   *
   * - if default path, use as is
   * - otherwise use super.resolve()
   *
   * @returns {string}
   */
  resolve(): string {
    return this.isDefault() ? path.join(this._default.dir, this._default.base) : super.resolve();
  }
}

class IgnoreFile extends PathProxy {
  /**
   * Rules to resolves path:
   *
   * - if default, use the **project** directory and the default base filename
   * - otherwise use super.resolve()
   *
   * @returns {string}
   */
  resolve(): string {
    return this.isDefault() ? path.join(Conf.get().project.resolvedDir, this._default.base) : super.resolve();
  }
}

// TODO: add more subclasses if necessary
