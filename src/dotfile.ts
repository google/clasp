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
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Credentials } from 'google-auth-library';
import { OAuth2ClientOptions } from 'google-auth-library/build/src/auth/oauth2client';

const dotf = require('dotf');
const read = require('read-file');
import * as findParentDir from 'find-parent-dir';
const splitLines = require('split-lines');

// TEMP CIRCULAR DEPS, TODO REMOVE
// import { PROJECT_NAME } from './utils';
const PROJECT_NAME = 'clasp';

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
   * This dotfile stores information about ignoring files on `push`. Like .gitignore.
   */
  IGNORE: {
    DIR: '~',
    NAME: `${PROJECT_NAME}ignore`,
    PATH: `.${PROJECT_NAME}ignore`,
  },
  /**
   * This dotfile saves clasp project information, local to project directory.
   */
  PROJECT: {
    DIR: path.join('.', '/'), // Relative to where the command is run. See DOTFILE.PROJECT()
    NAME: `${PROJECT_NAME}.json`,
    PATH: `.${PROJECT_NAME}.json`,
  },
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
    LOCAL_PATH: `.${PROJECT_NAME}rc.json`,
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
    const projectDirectory: string = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
    return new Promise<string[]>((res, rej) => {
      if (fs.existsSync(path.join(projectDirectory, DOT.IGNORE.PATH))) {
        const buffer = read.sync(DOT.IGNORE.PATH, 'utf8');
        res(splitLines(buffer).filter((name: string) => name));
      } else {
        res([]);
      }
    });
  },
  /**
   * Gets the closest DOT.PROJECT.NAME in the parent directory of the directory
   * that the command was run in.
   * @return {dotf} A dotf with that dotfile. Null if there is no file
   */
  PROJECT: () => {
    const projectDirectory: string = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.PROJECT.DIR;
    return dotf(projectDirectory, DOT.PROJECT.NAME);
  },
  // Stores {ClaspCredentials}
  RC: dotf(DOT.RC.DIR, DOT.RC.NAME),
  // Stores {ClaspCredentials}
  RC_LOCAL: () => {
    const localDirectory: string = findParentDir.sync(process.cwd(), DOT.PROJECT.PATH) || DOT.RC.LOCAL_DIR;
    return dotf(localDirectory, DOT.RC.NAME);
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
