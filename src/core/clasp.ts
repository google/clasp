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

/**
 * @fileoverview This file defines the main `Clasp` class and the `initClaspInstance`
 * factory function. The `Clasp` class encapsulates all core operations of the CLI,
 * such as file management, project interaction, and API service control.
 * `initClaspInstance` is responsible for setting up a `Clasp` object based on
 * project configuration files (.clasp.json, .claspignore) and command-line options.
 */

import path from 'path';
import Debug from 'debug';
import {findUpSync} from 'find-up';
import fs from 'fs/promises';
import {OAuth2Client} from 'google-auth-library';
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

/**
 * Default ignore patterns used if a `.claspignore` file is not found.
 * These patterns exclude common non-script files and directories.
 */
const DEFAULT_CLASP_IGNORE: string[] = [
  '**/**', // Ignore everything by default
  '!**/appsscript.json', // ...except the manifest file
  '!**/*.gs', // ...and .gs files
  '!**/*.js', // ...and .js files
  '!**/*.ts', // ...and .ts files (if not compiled to .js before push)
  '!**/*.html', // ...and .html files for UI
  '.git/**', // Ignore git directory
  'node_modules/**', // Ignore node_modules
];

/**
 * Options for initializing a Clasp instance via `initClaspInstance`.
 */
export type InitOptions = {
  /** Authenticated OAuth2Client, if available. */
  credentials?: OAuth2Client;
  /** Path to the .clasp.json configuration file or its directory. */
  configFile?: string;
  /** Path to the .claspignore file or its directory. */
  ignoreFile?: string;
  /** Root directory of the project if .clasp.json is not found. */
  rootDir?: string;
};

/**
 * The main class for interacting with Google Apps Script projects.
 * It provides methods for managing files, projects, services, logs, and functions.
 */
export class Clasp {
  private options: ClaspOptions;
  /** Manages Google API services for the project. */
  readonly services: Services;
  /** Manages local and remote project files. */
  readonly files: Files;
  /** Manages Apps Script project metadata and deployments. */
  readonly project: Project;
  /** Manages fetching logs from Cloud Logging. */
  readonly logs: Logs;
  /** Manages execution of Apps Script functions. */
  readonly functions: Functions;

  /**
   * Constructs a Clasp instance.
   * @param options Configuration options for the Clasp instance.
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

  /**
   * Retrieves the ID of the currently authorized user.
   * @returns A promise that resolves with the user's ID, or undefined if not authenticated or an error occurs.
   */
  async authorizedUser(): Promise<string | undefined> {
    if (!this.options.credentials) {
      return undefined; // Not authenticated.
    }
    try {
      const user = await getUserInfo(this.options.credentials);
      return user?.id;
    } catch (err) {
      debug('Unable to fetch user info during authorizedUser call: %O', err);
      // Do not rethrow, just return undefined as user ID couldn't be determined.
    }
    return undefined;
  }

  /**
   * Fluent method to set the script ID for the Clasp instance.
   * This is typically used when creating a new project or cloning an existing one
   * where the script ID is not yet in a .clasp.json file.
   * @param scriptId The Apps Script project ID.
   * @returns The current Clasp instance for chaining.
   * @throws Error if the project options are already set (i.e., from a .clasp.json file).
   */
  withScriptId(scriptId: string): this {
    if (this.options.project?.scriptId) {
      // Prevent overwriting if already loaded from a config file.
      // For re-association, a new Clasp instance should generally be created or settings explicitly cleared.
      throw new Error('Script project ID is already set. Create a new Clasp instance or clear existing project settings to re-initialize with a new script ID.');
    }

    this.options.project = {...this.options.project, scriptId};
    return this;
  }

  /**
   * Fluent method to set the content directory (srcDir/rootDir) for the Clasp instance.
   * This determines where clasp looks for local script files.
   * @param contentDir The path to the content directory. Can be relative or absolute.
   * @returns The current Clasp instance for chaining.
   */
  withContentDir(contentDir: string): this {
    // Resolve relative paths based on the project's root directory.
    if (!path.isAbsolute(contentDir)) {
      // Ensure projectRootDir is defined before resolving.
      // If initClaspInstance hasn't fully run, projectRootDir might be the CWD placeholder.
      const baseDir = this.options.files.projectRootDir || process.cwd();
      contentDir = path.resolve(baseDir, contentDir);
    }
    this.options.files.contentDir = contentDir;
    return this;
  }
}

/**
 * Initializes a Clasp instance by resolving configuration files and settings.
 * It searches for `.clasp.json` and `.claspignore` files, loads their content,
 * or uses defaults if files are not found.
 * @param options Options for initializing the Clasp instance.
 * @returns A promise that resolves with a fully configured Clasp instance.
 */
export async function initClaspInstance(options: InitOptions): Promise<Clasp> {
  debug('Initializing clasp instance with provided options: %O', options);

  // Attempt to find the project root directory based on .clasp.json.
  const projectRootDetails = await findProjectRootDir(options.configFile);

  if (!projectRootDetails) {
    // No .clasp.json found, create a default Clasp setup in the specified or current directory.
    const effectiveRootDir = options.rootDir ?? process.cwd();
    debug(`No .clasp.json found. Initializing clasp in directory: ${effectiveRootDir}`);
    const resolvedRootDir = path.resolve(effectiveRootDir);
    const claspJsonPath = path.resolve(resolvedRootDir, '.clasp.json');
    const ignoreFilePath = await findIgnoreFile(resolvedRootDir, options.ignoreFile);
    const ignorePatterns = await loadIgnoreFileOrDefaults(ignoreFilePath);

    // Create a Clasp instance with default/inferred settings.
    return new Clasp({
      credentials: options.credentials,
      configFilePath: claspJsonPath, // Path where .clasp.json would be if it existed or is created.
      files: {
        projectRootDir: resolvedRootDir,
        contentDir: resolvedRootDir, // Default content directory is the root.
        ignoreFilePath: ignoreFilePath,
        ignorePatterns: ignorePatterns,
        filePushOrder: [], // No explicit file push order.
        skipSubdirectories: false, // Default to not skipping subdirectories.
        fileExtensions: readFileExtensions({}), // Default file extensions.
      },
      // No project options (scriptId, etc.) as .clasp.json was not found.
    });
  }

  // .clasp.json was found, load configuration from it.
  debug('Project configuration found at: %s', projectRootDetails.configPath);
  const ignoreFilePath = await findIgnoreFile(projectRootDetails.rootDir, options.ignoreFile);
  const ignorePatterns = await loadIgnoreFileOrDefaults(ignoreFilePath);

  const configFileContent = await fs.readFile(projectRootDetails.configPath, {encoding: 'utf8'});
  const projectConfig = JSON.parse(configFileContent); // TODO: Add error handling for malformed JSON.

  const fileExtensions = readFileExtensions(projectConfig);
  const filePushOrder = projectConfig.filePushOrder ?? []; // Use '??' for nullish coalescing.

  // Determine the content directory: use srcDir, then rootDir from config, else default to project root.
  const contentDirSource = projectConfig.srcDir ?? projectConfig.rootDir ?? '.';
  const resolvedContentDir = path.resolve(projectRootDetails.rootDir, contentDirSource);
  // Create Clasp instance with loaded and resolved settings.
  return new Clasp({
    credentials: options.credentials,
    configFilePath: projectRootDetails.configPath,
    files: {
      projectRootDir: projectRootDetails.rootDir,
      contentDir: resolvedContentDir,
      ignoreFilePath: ignoreFilePath,
      ignorePatterns: ignorePatterns,
      filePushOrder: filePushOrder,
      fileExtensions: fileExtensions,
      skipSubdirectories: projectConfig.ignoreSubdirectories ?? false, // Default to false if undefined.
    },
    project: {
      scriptId: projectConfig.scriptId,
      projectId: projectConfig.projectId,
      parentId: firstValue(projectConfig.parentId), // Handle potential array of parentIds.
    },
  });
}

/**
 * Reads and normalizes file extension settings from the project configuration.
 * Supports legacy `fileExtension` and modern `scriptExtensions`, `htmlExtensions`, `jsonExtensions`.
 * @param config The project configuration object (from .clasp.json).
 * @returns An object mapping file types (SERVER_JS, HTML, JSON) to arrays of their extensions.
 */
function readFileExtensions(config: Record<string, unknown> | undefined): ClaspOptions['files']['fileExtensions'] {
  let scriptExtensions = ['.js', '.gs']; // Default script extensions
  let htmlExtensions = ['.html'];    // Default HTML extensions
  let jsonExtensions = ['.json'];    // Default JSON extensions (specifically for appsscript.json)

  // Helper to normalize extensions (lowercase, ensure leading dot).
  const normalizeExt = (ext: string): string => {
    let normalized = ext.toLowerCase().trim();
    if (!normalized.startsWith('.')) {
      normalized = `.${normalized}`;
    }
    return normalized;
  };

  if (config) {
    // Handle legacy 'fileExtension' for script files.
    if (typeof config.fileExtension === 'string') {
      scriptExtensions = [normalizeExt(config.fileExtension)];
    }
    // Handle modern extension settings.
    if (config.scriptExtensions) {
      scriptExtensions = ensureStringArray(config.scriptExtensions as string | string[]).map(normalizeExt);
    }
    if (config.htmlExtensions) {
      htmlExtensions = ensureStringArray(config.htmlExtensions as string | string[]).map(normalizeExt);
    }
    if (config.jsonExtensions) {
      jsonExtensions = ensureStringArray(config.jsonExtensions as string | string[]).map(normalizeExt);
    }
  }

  return {
    SERVER_JS: scriptExtensions,
    HTML: htmlExtensions,
    JSON: jsonExtensions,
  };
}

/**
 * Finds the root directory of a clasp project by searching for a `.clasp.json` file.
 * It checks a provided path first, then searches upwards from the current working directory.
 * @param configFilePath Optional path to a specific .clasp.json file or its directory.
 * @returns A promise that resolves to an object containing `rootDir` and `configPath` if found, otherwise undefined.
 */
async function findProjectRootDir(configFilePath?: string): Promise<{rootDir: string; configPath: string} | undefined> {
  debug('Searching for project root directory...');
  let resolvedConfigPath = configFilePath;

  if (resolvedConfigPath) {
    // If a configFile path is provided, check if it's a directory or a file.
    try {
      const info = await fs.stat(resolvedConfigPath);
      if (info.isDirectory()) {
        debug(`Provided config path ${resolvedConfigPath} is a directory. Looking for .clasp.json inside.`);
        resolvedConfigPath = path.join(resolvedConfigPath, '.clasp.json');
      }
    } catch (error) {
      // If stat fails, path might not exist or is inaccessible. findUpSync will handle CWD.
      debug(`Error stating provided config path ${resolvedConfigPath}: ${error.message}. Falling back to findUpSync.`);
      resolvedConfigPath = findUpSync('.clasp.json');
    }
  } else {
    // No configFile path provided, search upwards from current directory.
    debug('No config file path provided. Searching upwards for .clasp.json from CWD.');
    resolvedConfigPath = findUpSync('.clasp.json');
  }

  if (!resolvedConfigPath) {
    debug('No .clasp.json file found.');
    return undefined;
  }

  // Check if the found config file is readable.
  if (!(await hasReadAccess(resolvedConfigPath))) {
    debug(`Found .clasp.json at ${resolvedConfigPath}, but it is not readable.`);
    return undefined; // Or throw an error, depending on desired behavior.
  }

  debug(`Project root found. .clasp.json is at: ${resolvedConfigPath}`);
  const rootDir = path.dirname(resolvedConfigPath);
  return {rootDir, configPath: resolvedConfigPath};
}

/**
 * Finds the `.claspignore` file.
 * It checks a provided path first, then defaults to looking in the specified project directory.
 * @param projectDir The root directory of the clasp project.
 * @param ignoreFilePath Optional path to a specific .claspignore file or its directory.
 * @returns A promise that resolves with the path to the .claspignore file if found and readable, otherwise undefined.
 */
async function findIgnoreFile(projectDir: string, ignoreFilePath?: string): Promise<string | undefined> {
  debug('Searching for .claspignore file...');
  let resolvedIgnorePath = ignoreFilePath;

  if (resolvedIgnorePath) {
    // If an ignoreFile path is provided, check if it's a directory or a file.
    try {
      const info = await fs.stat(resolvedIgnorePath);
      if (info.isDirectory()) {
        debug(`Provided ignore path ${resolvedIgnorePath} is a directory. Looking for .claspignore inside.`);
        resolvedIgnorePath = path.join(resolvedIgnorePath, '.claspignore');
      }
    } catch (error) {
      debug(`Error stating provided ignore path ${resolvedIgnorePath}: ${error.message}. Falling back to default location.`);
      resolvedIgnorePath = path.join(projectDir, '.claspignore');
    }
  } else {
    // No ignoreFile path provided, look in the project directory.
    debug(`No ignore file path provided. Looking for .claspignore in ${projectDir}.`);
    resolvedIgnorePath = path.join(projectDir, '.claspignore');
  }

  if (!(await hasReadAccess(resolvedIgnorePath))) {
    debug(`.claspignore file not found or not readable at ${resolvedIgnorePath}.`);
    return undefined;
  }

  debug(`.claspignore file found at: ${resolvedIgnorePath}`);
  return resolvedIgnorePath;
}

/**
 * Loads ignore rules from the `.claspignore` file if it exists,
 * otherwise returns the default set of ignore patterns.
 * @param ignoreFilePath Optional path to the .claspignore file.
 * @returns A promise that resolves with an array of ignore patterns.
 */
async function loadIgnoreFileOrDefaults(ignoreFilePath?: string): Promise<string[]> {
  if (!ignoreFilePath) {
    debug('No .claspignore file found. Using default ignore patterns.');
    return DEFAULT_CLASP_IGNORE;
  }
  try {
    let fileContent = await fs.readFile(ignoreFilePath, {encoding: 'utf8'});
    fileContent = stripBom(fileContent); // Remove Byte Order Mark if present.
    // Split into lines and filter out empty lines or comments (if any standard comment syntax were adopted).
    return splitLines(fileContent).filter((line: string) => line.trim().length > 0 && !line.trim().startsWith('#'));
  } catch (error) {
    debug(`Error reading .claspignore file at ${ignoreFilePath}: ${error.message}. Using default patterns.`);
    return DEFAULT_CLASP_IGNORE;
  }
}

/**
 * Checks if the current process has read access to the given path.
 * @param filePath The path to check.
 * @returns A promise that resolves with true if readable, false otherwise.
 */
async function hasReadAccess(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Utility function to get the first element if `values` is an array,
 * otherwise returns the value itself. This is useful for config properties
 * that might be a single string or an array of strings (e.g., parentId).
 * @param values The value or array of values.
 * @returns The first value if an array, or the value itself. Undefined if input is undefined or empty array.
 * @template T The type of the value(s).
 */
function firstValue<T>(values: T | T[] | undefined): T | undefined {
  if (Array.isArray(values)) {
    return values.length > 0 ? values[0] : undefined;
  }
  return values; // Works for single T value or undefined.
}
