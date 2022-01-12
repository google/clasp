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
import dotf from 'dotf';
import fs from 'fs-extra';
import path from 'path';
import splitLines from 'split-lines';
import stripBom from 'strip-bom';

import {Conf} from './conf.js';
import {FS_OPTIONS} from './constants.js';

import type {Credentials, OAuth2ClientOptions} from 'google-auth-library';

export type {Dotfile} from 'dotf';

const config = Conf.get();

// Project settings file (Saved in .clasp.json)
export interface ProjectSettings {
  scriptId: string;
  rootDir?: string;
  projectId?: string;
  fileExtension?: string;
  filePushOrder?: string[];
  parentId?: string[];
}

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
   * Reads ignore.resolve() to get a glob pattern of ignored paths.
   * @return {Promise<string[]>} A list of file glob patterns
   */
  IGNORE: async () => {
    const ignorePath = config.ignore;
    const content =
      ignorePath && fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, FS_OPTIONS) : defaultClaspignore;

    return splitLines(stripBom(content)).filter((name: string) => name.length > 0);
  },
  /**
   * Gets the closest DOT.PROJECT.NAME in the parent directory of the directory
   * that the command was run in.
   * @return {Dotf} A dotf with that dotfile. Null if there is no file
   */
  PROJECT: () => {
    // ! TODO: currently limited if filename doesn't start with a dot '.'
    const {dir, base} = path.parse(config.projectConfig!);
    if (base.startsWith('.')) {
      return dotf(dir || '.', base.slice(1));
    }
    throw new Error('Project file must start with a dot (i.e. .clasp.json)');
  },
  // Stores {ClaspCredentials}
  AUTH: (local?: boolean) => {
    const configPath = local ? config.authLocal : config.auth;
    // ! TODO: currently limited if filename doesn't start with a dot '.'
    const {dir, base} = path.parse(configPath!);
    if (base.startsWith('.')) {
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
