import * as os from 'os';
const path = require('path');

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