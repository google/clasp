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

import os from 'os';
import path from 'path';
import findUp from 'find-up';
import fs from 'fs-extra';
import {Credentials, OAuth2ClientOptions} from 'google-auth-library';
import stripBom from 'strip-bom';
import dotf from 'dotf';
import splitLines from 'split-lines';

import {Conf} from './conf';
import {FS_OPTIONS} from './constants';

import type {Credentials, OAuth2ClientOptions} from 'google-auth-library';

export type {Dotfile} from 'dotf';

const {auth, ignore, project} = Conf.get();

// Project settings file (Saved in .clasp.json)
export interface ProjectSettings {
  scriptId: string;
  rootDir?: string;
  projectId?: string;
  fileExtension?: string;
  filePushOrder?: string[];
  parentId?: string[];
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

const defaultClaspignore = `# ignore all files…
**/**

# except the extensions…
!appsscript.json
!**/*.gs
!**/*.js
!**/*.ts
!**/*.html

# ignore even valid files if in…
.git/**
node_modules/**
`;

// Methods for retrieving dotfiles.
export const DOTFILE = {
  /**
   * Reads DOT.IGNORE.PATH to get a glob pattern of ignored paths.
   * @return {Promise<string[]>} A list of file glob patterns
   */
  IGNORE: async () => {
    const localPath = await findUp(DOT.PROJECT.PATH);
    const usePath = path.join(localPath ? path.dirname(localPath) : DOT.PROJECT.DIR);
    const content =
      fs.existsSync(usePath) && fs.existsSync(DOT.IGNORE.PATH)
        ? fs.readFileSync(DOT.IGNORE.PATH, FS_OPTIONS)
        : defaultClaspignore;

    return splitLines(stripBom(content)).filter((name: string) => name.length > 0);
  },
  /**
   * Gets the closest DOT.PROJECT.NAME in the parent directory of the directory
   * that the command was run in.
   * @return {Dotf} A dotf with that dotfile. Null if there is no file
   */
  PROJECT: () => {
    const localPath = findUp.sync(DOT.PROJECT.PATH);
    const usePath = localPath ? path.dirname(localPath) : DOT.PROJECT.DIR;
    return dotf(usePath, DOT.PROJECT.NAME);
  },
  // Stores {ClaspCredentials}
  RC: dotf(DOT.RC.DIR, DOT.RC.NAME),
  // Stores {ClaspCredentials}
  RC_LOCAL: () => {
    const localPath = findUp.sync(DOT.PROJECT.PATH);
    const usePath = localPath ? path.dirname(localPath) : DOT.RC.LOCAL_DIR;
    return dotf(usePath, DOT.RC.NAME);
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
