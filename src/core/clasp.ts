// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file defines the main `Clasp` class, which orchestrates all core
// functionalities of the CLI, including configuration management, API
// interactions, and file operations.

import path from 'path';
import Debug from 'debug';
import {findUpSync} from 'find-up';
import fs from 'fs/promises';
import {OAuth2Client} from 'google-auth-library';
import JSON5 from 'json5';
import splitLines from 'split-lines';
import stripBom from 'strip-bom';
import {getUserInfo} from '../auth/auth.js';
import {Files} from './files.js';
import {Functions} from './functions.js';
import {Logs} from './logs.js';
import {Project} from './project.js';
import {Services} from './services.js';
import {ClaspOptions, ensureStringArray} from './utils.js';

const debug = Debug('clasp:core');

const DEFAULT_CLASP_IGNORE = [
  '**/**',
  '!**/appsscript.json',
  '!**/*.gs',
  '!**/*.js',
  '!**/*.ts',
  '!**/*.html',
  '.git/**',
  'node_modules/**',
];

/**
 * Options for initializing a Clasp instance.
 * @property {OAuth2Client} [credentials] - Optional OAuth2 client for authentication.
 * @property {string} [configFile] - Path to the .clasp.json configuration file or its directory.
 * @property {string} [ignoreFile] - Path to the .claspignore file or its directory.
 * @property {string} [rootDir] - The root directory of the project if no config file is found. Defaults to process.cwd().
 */
export type InitOptions = {
  credentials?: OAuth2Client;
  configFile?: string;
  ignoreFile?: string;
  rootDir?: string;
};

/**
 * Main class for interacting with Google Apps Script projects.
 * It encapsulates all core functionalities like file management,
 * project settings, API interactions, and authentication.
 */
export class Clasp {
  private options: ClaspOptions;
  readonly services: Services;
  readonly files: Files;
  readonly project: Project;
  readonly logs: Logs;
  readonly functions: Functions;

  /**
   * Creates an instance of the Clasp class.
   * @param {ClaspOptions} options - Configuration options for the Clasp instance.
   */
  constructor(options: ClaspOptions) {
    debug('Creating clasp instance with options: %O', options);
    this.options = options;
    this.services = new Services(options);
    this.files = new Files(options);
    this.project = new Project(options);
    this.logs = new Logs(options);
    this.functions = new Functions(options);
  }

  async authorizedUser() {
    if (!this.options.credentials) {
      return undefined;
    }
    try {
      const user = await getUserInfo(this.options.credentials);
      return user?.id;
    } catch (err) {
      debug('Unable to fetch user info, %O', err);
    }
    return undefined;
  }

  /**
   * Configures the Clasp instance with a specific Apps Script project ID.
   * This is a fluent method and returns the `Clasp` instance for chaining.
   * @param {string} scriptId - The ID of the Apps Script project.
   * @returns {this} The current Clasp instance.
   * @throws {Error} If the project is already set.
   */
  withScriptId(scriptId: string) {
    if (this.options.project) {
      debug('Project is already configured, overriding scriptId with %s', scriptId);
    }

    this.options.project = {
      scriptId,
    };
    return this;
  }

  /**
   * Sets the content directory for the project files.
   * This directory is where clasp looks for source files (e.g., `.js`, `.html`).
   * If a relative path is provided, it's resolved against the project's root directory.
   * This is a fluent method and returns the `Clasp` instance for chaining.
   * @param {string} contentDir - The path to the content directory.
   * @returns {this} The current Clasp instance.
   */
  withContentDir(contentDir: string) {
    if (!path.isAbsolute(contentDir)) {
      contentDir = path.resolve(this.options.files.projectRootDir, contentDir);
    }
    this.options.files.contentDir = contentDir;
    return this;
  }
}

/**
 * Initializes and returns a Clasp instance.
 * This function searches for project configuration files (`.clasp.json`, `.claspignore`),
 * loads them if found, or sets up default configurations if not. It then creates
 * and returns a new `Clasp` object configured with these settings.
 * @param {InitOptions} options - Options for initializing the Clasp instance.
 * @returns {Promise<Clasp>} A promise that resolves to a configured Clasp instance.
 */
export async function initClaspInstance(options: InitOptions): Promise<Clasp> {
  debug('Initializing clasp instance');
  // Attempt to find the project root directory and .clasp.json config file.
  const projectRoot = await findProjectRootdDir(options.configFile);

  // If no .clasp.json is found, set up a default Clasp instance.
  if (!projectRoot) {
    // Use the provided rootDir option or default to the current working directory.
    const dir = options.rootDir ?? process.cwd();
    debug(`No project found, defaulting to ${dir}`);
    const rootDir = path.resolve(dir);
    // Default path for .clasp.json if one were to be created.
    const configFilePath = path.resolve(rootDir, '.clasp.json');
    const ignoreFile = await findIgnoreFile(rootDir, options.ignoreFile);
    const ignoreRules = await loadIgnoreFileOrDefaults(ignoreFile);
    // Create a Clasp instance with default file settings and no project-specific config.
    return new Clasp({
      credentials: options.credentials,
      configFilePath, // Path where .clasp.json would be.
      files: {
        projectRootDir: rootDir,
        contentDir: rootDir, // By default, content directory is the root directory.
        ignoreFilePath: ignoreFile,
        ignorePatterns: ignoreRules,
        filePushOrder: [], // No specific push order.
        skipSubdirectories: false, // Process subdirectories by default.
        fileExtensions: readFileExtensions({}), // Default file extensions.
      },
      // No project options (scriptId, projectId, parentId) as .clasp.json was not found.
    });
  }

  // If .clasp.json is found, load its configuration.
  debug('Project config found at %s', projectRoot.configPath);
  const ignoreFile = await findIgnoreFile(projectRoot.rootDir, options.ignoreFile);
  const ignoreRules = await loadIgnoreFileOrDefaults(ignoreFile);

  const content = await fs.readFile(projectRoot.configPath, {encoding: 'utf8'});
  const config = JSON5.parse(content); // Parse the JSON content of .clasp.json.

  // Determine file extensions, push order, and content directory from the loaded config.
  const fileExtensions = readFileExtensions(config);
  const filePushOrder = config.filePushOrder || []; // Default to empty array if not specified.
  // Content directory can be specified by `srcDir` or `rootDir` in .clasp.json, defaulting to project root.
  const contentDir = path.resolve(projectRoot.rootDir, config.srcDir || config.rootDir || '.');

  return new Clasp({
    credentials: options.credentials,
    configFilePath: projectRoot.configPath,
    files: {
      projectRootDir: projectRoot.rootDir,
      contentDir: contentDir,
      ignoreFilePath: ignoreFile,
      ignorePatterns: ignoreRules,
      filePushOrder: filePushOrder,
      fileExtensions: fileExtensions,
      skipSubdirectories: config.skipSubdirectories ?? false,
    },
    project: {
      scriptId: config.scriptId,
      projectId: config.projectId,
      parentId: firstValue(config.parentId),
    },
  });
}

function readFileExtensions(config: any | undefined) {
  let scriptExtensions = ['js', 'gs']; // Default script file extensions.
  let htmlExtensions = ['html']; // Default HTML file extensions.
  let jsonExtensions = ['json']; // Default JSON file extensions (primarily for appsscript.json).

  // Support for legacy `fileExtension` setting (singular).
  if (config?.fileExtension) {
    scriptExtensions = [config.fileExtension];
  }
  // Support for current `scriptExtensions` setting (plural, array).
  if (config?.scriptExtensions) {
    scriptExtensions = ensureStringArray(config.scriptExtensions);
  }
  if (config?.htmlExtensions) {
    htmlExtensions = ensureStringArray(config.htmlExtensions);
  }
  if (config?.jsonExtensions) {
    jsonExtensions = ensureStringArray(config.jsonExtensions);
  }

  // Ensure all extensions are lowercase and start with a dot.
  const fixupExtension = (ext: string) => {
    ext = ext.toLowerCase().trim();
    if (!ext.startsWith('.')) {
      ext = `.${ext}`;
    }
    return ext;
  };
  return {
    SERVER_JS: scriptExtensions.map(fixupExtension),
    HTML: htmlExtensions.map(fixupExtension),
    JSON: jsonExtensions.map(fixupExtension),
  };
}
async function findProjectRootdDir(configFilePath?: string) {
  debug('Searching for project root');
  if (configFilePath) {
    debug('Checking for config file at %s', configFilePath);
    let info: Awaited<ReturnType<typeof fs.stat>>;
    try {
      info = await fs.stat(configFilePath);
    } catch (error) {
      if (isPathNotFoundError(error)) {
        throw new Error(`Invalid --project path: ${configFilePath}. File or directory does not exist.`);
      }
      throw error;
    }
    if (info.isDirectory()) {
      debug('Is directory, trying file');
      configFilePath = path.join(configFilePath, '.clasp.json');
    }
  } else {
    debug('Searching parent paths for .clasp.json');
    configFilePath = findUpSync('.clasp.json');
  }

  if (!configFilePath) {
    debug('No project found');
    return undefined;
  }

  const configFileExists = await hasReadAccess(configFilePath);
  if (!configFileExists) {
    debug('Project file %s does not exist', configFilePath);
    return undefined;
  }

  debug('Project found at %s', configFilePath);
  const rootDir = path.dirname(configFilePath);
  return {
    rootDir,
    configPath: configFilePath,
  };
}

async function findIgnoreFile(projectDir: string, configFilePath?: string) {
  debug('Searching for ignore file');
  if (configFilePath) {
    debug('Checking for ignore file at %s', configFilePath);
    let info: Awaited<ReturnType<typeof fs.stat>>;
    try {
      info = await fs.stat(configFilePath);
    } catch (error) {
      if (isPathNotFoundError(error)) {
        throw new Error(`Invalid --ignore path: ${configFilePath}. File or directory does not exist.`);
      }
      throw error;
    }
    if (info.isDirectory()) {
      debug('Is directory, trying file');
      configFilePath = path.join(configFilePath, '.claspignore');
    }
  } else {
    debug('Checking default location');
    configFilePath = path.join(projectDir, '.claspignore');
  }

  if (!configFilePath) {
    debug('No ignore file found');
    return undefined;
  }

  const configFileExists = await hasReadAccess(configFilePath);
  if (!configFileExists) {
    debug('ignore file %s does not exist', configFilePath);
    return undefined;
  }
  debug('Ignore file found at %s', configFilePath);
  return configFilePath;
}

async function loadIgnoreFileOrDefaults(configPath?: string) {
  if (!configPath) {
    debug('Using default file ignore rules');
    return DEFAULT_CLASP_IGNORE;
  }
  let content = await fs.readFile(configPath, {encoding: 'utf8'});
  content = stripBom(content);
  return splitLines(content).filter((name: string) => name.length > 0);
}

async function hasReadAccess(path: string): Promise<boolean> {
  try {
    await fs.access(path, fs.constants.R_OK);
  } catch {
    return false;
  }
  return true;
}

function firstValue<T>(values: T | T[] | undefined): T | undefined {
  if (Array.isArray(values) && values.length > 0) {
    return values[0];
  }
  return values as T | undefined;
}

function isPathNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR';
}
