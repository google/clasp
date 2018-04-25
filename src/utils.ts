import * as os from 'os';
const path = require('path');
const findParentDir = require('find-parent-dir');
const splitLines = require('split-lines');
import * as fs from 'fs';
const dotf = require('dotf');
const read = require('read-file');
import { Spinner } from 'cli-spinner';
import { ERROR } from '../index.js';

// Names / Paths
export const PROJECT_NAME = 'clasp';
export const PROJECT_MANIFEST_BASENAME = 'appsscript';

// Dotfile names
export const DOT = {
    IGNORE: { // Ignores files on `push`
      DIR: '~',
      NAME: `${PROJECT_NAME}ignore`,
      PATH: `.${PROJECT_NAME}ignore`,
    },
    PROJECT: { // Saves project information, local to project directory
      DIR: path.join('.', '/'), // Relative to where the command is run. See DOTFILE.PROJECT()
      NAME: `${PROJECT_NAME}.json`,
      PATH: `.${PROJECT_NAME}.json`,
    },
    RC: { // Saves global information, in the $HOME directory
      DIR: '~',
      LOCAL_DIR: './',
      NAME: `${PROJECT_NAME}rc.json`,
      PATH: path.join('~', `.${PROJECT_NAME}rc.json`),
      ABSOLUTE_PATH: path.join(os.homedir(), `.${PROJECT_NAME}rc.json`),
    },
};

// Clasp settings file (Saved in ~/.clasprc.json)
export interface ClaspSettings {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
// Project settings file (Saved in .clasp.json)
export interface ProjectSettings {
  scriptId: string;
  rootDir: string;
  projectId: string;
}

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
  // See `login`: Stores { accessToken, refreshToken }
  RC: dotf(DOT.RC.DIR, DOT.RC.NAME),
  RC_LOCAL: dotf(DOT.RC.LOCAL_DIR, DOT.RC.NAME),
};

// Utils
export const spinner = new Spinner();

/**
 * Logs errors to the user such as unauthenticated or permission denied
 * @param  {object} err         The object from the request's error
 * @param  {string} description The description of the error
 */
export const logError = (err: any, description = '') => {
  // Errors are weird. The API returns interesting error structures.
  // TODO(timmerman) This will need to be standardized. Waiting for the API to
  // change error model. Don't review this method now.
  if (err && typeof err.error === 'string') {
    console.error(JSON.parse(err.error).error);
  } else if (err && err.statusCode === 401 || err && err.error &&
             err.error.error && err.error.error.code === 401) {
    console.error(ERROR.UNAUTHENTICATED);
  } else if (err && (err.error && err.error.code === 403 || err.code === 403)) {
    console.error(ERROR.PERMISSION_DENIED);
  } else {
    if (err && err.error) {
      console.error(`~~ API ERROR (${err.statusCode || err.error.code})`);
      console.error(err.error);
    }
    if (description) console.error(description);
  }
};