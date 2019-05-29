/**
 * Manages dotfiles. There are 2 types of dotfiles:
 *
 * Global clasp auth settings:
 * - File: ~/.clasp.json
 * - Default credentials for clasp projects.
 *
 * Local clasp auth settings:
 * - File: .clasp.json
 * - Requires `clasp login --creds creds.json`
 *
 * This should be the only file that uses DOTFILE.
 */
import * as os from 'os';
import * as path from 'path';
import * as findUp from 'find-up';
import * as fs from 'fs-extra';
import { Credentials } from 'google-auth-library';
import { OAuth2ClientOptions } from 'google-auth-library/build/src/auth/oauth2client';
import { Conf, PROJECT_NAME } from './conf';
import stripBom = require('strip-bom');

// Getting ready to switch to `dotf` embedded types
// import { default as dotf } from 'dotf';
// export { Dotfile } from 'dotf';

// When switching, comment-out the following two exports
export declare type Dotf = (dirname: string, name: string) => {
  exists: () => Promise<boolean>;
  read: <T>() => Promise<T>;
  write: <T>(obj: T) => Promise<T>;
  delete: () => Promise<void>;
};
export type Dotfile = ReturnType<Dotf>;

const dotf: Dotf = require('dotf');
const splitLines: (str: string, options?: { preserveNewLines?: boolean })
  => string[] = require('split-lines');

// Project settings file (Saved in .clasp.json)
export interface ProjectSettings {
  scriptId: string;
  rootDir?: string;
  projectId?: string;
  fileExtension?: string;
  filePushOrder?: string[];
}
// Dotfile names
export const DOT = {
  /**
   * This dotfile saves auth information. Should never be committed.
   * There are 2 types: personal & global:
   * - Global: In the $HOME directory.
   * - Personal: In the local directory.
   * @see {ClaspToken}
   */
  RC: {
    DIR: '~',
    LOCAL_DIR: './',
    NAME: `${PROJECT_NAME}rc.json`,
    // LOCAL_PATH: `.${PROJECT_NAME}rc.json`,
    PATH: path.join('~', `.${PROJECT_NAME}rc.json`),
    ABSOLUTE_PATH: path.join(os.homedir(), `.${PROJECT_NAME}rc.json`),
    ABSOLUTE_LOCAL_PATH: path.join('.', `.${PROJECT_NAME}rc.json`),
  },
};

// Methods for retrieving dotfiles.
export const DOTFILE = {
  /**
   * Reads DOT.IGNORE.PATH to get a glob pattern of ignored paths.
   * @return {Promise<string[]>} A list of file glob patterns
   */
  IGNORE: () => {
    const ignorePath = Conf.get().ignore.resolve();
    return new Promise<string[]>((resolve, reject) => {
      if (fs.existsSync(ignorePath)) {
        const buffer = stripBom(fs.readFileSync(ignorePath, { encoding: 'utf8' }));
        resolve(splitLines(buffer).filter((name: string) => name));
      } else {
        resolve(['**/**', '!appsscript.json', '!*.js', '!*.ts']);
      }
    });
  },
  /**
   * Gets the closest DOT.PROJECT.NAME in the parent directory of the directory
   * that the command was run in.
   * @return {Dotf} A dotf with that dotfile. Null if there is no file
   */
  PROJECT: () => {
    // ! TODO: currently limited if filename doesn't start with a dot '.'
    const { dir, base } = path.parse(Conf.get().project.resolve());
    if (base[0] === '.') {
      return dotf(dir || '.', base.slice(1));
    }
    throw new Error('Project file must start with a dot (i.e. .clasp.json)');
  },
  // Stores {ClaspCredentials}
  // ! TODO: currently limited if filename doesn't start with a dot '.'
  AUTH: () => {
    // ! TODO: currently limited if filename doesn't start with a dot '.'
    const { dir, base } = path.parse(Conf.get().auth.resolve());
    if (base[0] === '.') {
      return dotf(dir || '.', base.slice(1));
    }
    throw new Error('Auth file must start with a dot (i.e. .clasp.json)');
  },
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
  token: Credentials;
  oauth2ClientSettings: OAuth2ClientOptions;
  isLocalCreds: boolean;
}
