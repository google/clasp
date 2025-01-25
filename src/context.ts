import fs from 'fs';
import os from 'os';
import path from 'path';
import {findUpSync} from 'find-up';
import {OAuth2Client} from 'google-auth-library';
import splitLines from 'split-lines';
import stripBom from 'strip-bom';
import {createApplicationDefaultCredentials, getAuthorizedOAuth2Client} from './auth.js';
import {ClaspError} from './clasp-error.js';
import {CredentialStore, FileCredentialStore} from './credential_store.js';
import {Manifest} from './manifest.js';
import {ERROR} from './messages.js';

export const DEFAULT_CLASP_IGNORE = [
  '**/**',
  '!appsscript.json',
  '!**/*.gs',
  '!**/*.js',
  '!**/*.ts',
  '!**/*.html',
  '.git/**',
  'node_modules/**',
];

export interface Context {
  credentialStore: CredentialStore;
  credentials?: OAuth2Client;
  userKey: string;
  project?: Project;
}

export interface Settings {
  scriptId: string;
  srcDir?: string; // rootDir in .clasp.json
  rootDir?: string; // Deprecated
  projectId?: string;
  fileExtension?: string;
  filePushOrder?: string[];
  parentId?: string[];
}

export interface Project {
  projectRootDir: string;
  contentDir: string;
  configFilePath: string;
  // From clasp.json
  settings: Settings;
  // .claspignore
  ignorePatterns: string[];
  // appsscript.json
  manifest?: Manifest;
  recursive: boolean;
}

export type InitOptions = {
  env?: string;
  userKey?: string;
  useApplicationDefaultCredentials?: boolean;
  projectPath?: string;
  ignoreFilePath?: string;
  authFilePath?: string;
  srcDir?: string;
};

export async function createContext(options: InitOptions = {}): Promise<Context> {
  const authFilePath = options.authFilePath ?? path.join(os.homedir(), '.clasprc.json');
  const credentialStore = new FileCredentialStore(authFilePath);

  const context: Context = {
    credentialStore,
    userKey: options.userKey ?? 'default',
  };
  const projectRoot = findProjectRootdDir(options.projectPath, options.env);
  if (projectRoot) {
    // Project exists
    const ignoreFilePath = findIgnoreFile(projectRoot.rootDir, options.ignoreFilePath);
    const settings = loadProjectSettings(projectRoot.configPath);
    const contentDir = path.resolve(projectRoot.rootDir, settings.srcDir ?? '.');
    const ignorePatterns = loadIgnoreFileOrDefaults(ignoreFilePath);
    const manifest = loadManifest(contentDir);
    context.project = {
      settings,
      projectRootDir: projectRoot.rootDir,
      contentDir: contentDir,
      configFilePath: projectRoot.configPath,
      ignorePatterns,
      recursive: ignoreFilePath !== undefined,
      manifest,
    };
  }
  if (options.useApplicationDefaultCredentials) {
    context.credentials = await createApplicationDefaultCredentials();
  } else {
    context.credentials = await getAuthorizedOAuth2Client(context.credentialStore, options.userKey);
  }

  return context;
}

export function assertAuthenticated(context: Context): asserts context is Context & {credentials: OAuth2Client} {
  if (!context.credentials) {
    throw new ClaspError(ERROR.NO_CREDENTIALS);
  }
}

export function assertScriptSettings(context: Context): asserts context is Context & {project: Project} {
  if (!context.project) {
    throw new ClaspError(ERROR.SETTINGS_DNE());
  }
}

export function assertHasGcpProject(
  context: Context,
): asserts context is Context & {project: {settings: {projectId: string}}} {
  assertScriptSettings(context);
  if (!context.project.settings.projectId) {
    throw new ClaspError(ERROR.NO_GCLOUD_PROJECT(context.project.configFilePath));
  }
}

export function makeClaspConfigFileName(env?: string): string {
  return env ? `.clasp.${env}.json` : '.clasp.json';
}

/**
 * Finds the project root directory and validates that a config file exists. Does not validate
 * the contents of config file.
 *
 * Search order is:
 * * Path (file or directory containing .clasp.json) provided as an argument (CLI param)
 * * Environment variable clasp_config_project
 * * Upward search for first .clasp.json from current working directory.
 *
 * If an explicit location is provided but no file exists, no attempt to search upwards is made.
 */
function findProjectRootdDir(
  fileOrDirectoryPath?: string,
  env?: string | undefined,
): {rootDir: string; configPath: string} | undefined {
  let configPath = fileOrDirectoryPath;
  const fileName = makeClaspConfigFileName(env);

  if (configPath) {
    const info = fs.statSync(configPath);
    if (info.isDirectory()) {
      configPath = path.join(configPath, fileName);
    }
  } else {
    configPath = findUpSync(fileName);
  }

  if (!configPath) {
    return undefined;
  }

  if (!fs.existsSync(configPath)) {
    return undefined;
  }

  const rootDir = path.dirname(configPath);
  return {
    rootDir,
    configPath,
  };
}

function loadProjectSettings(configPath: string): Settings {
  const settings = fs.readFileSync(configPath, {encoding: 'utf8'});
  const parsedSettings = JSON.parse(settings);

  return {
    scriptId: parsedSettings.scriptId,
    srcDir: parsedSettings.srcDir ?? parsedSettings.rootDir,
    projectId: parsedSettings.projectId,
    fileExtension: parsedSettings.fileExtension,
    filePushOrder: parsedSettings.filePushOrder,
    parentId: parsedSettings.parentId,
  };
}

function findIgnoreFile(projectRootDir: string, configPath?: string) {
  if (configPath) {
    const info = fs.statSync(configPath);
    if (info.isDirectory()) {
      configPath = path.join(configPath, '.claspignore');
    }
  } else {
    configPath = path.join(projectRootDir, '.claspignore');
  }
  if (fs.existsSync(configPath)) {
    return configPath;
  }
  return undefined;
}

function loadIgnoreFileOrDefaults(configPath?: string) {
  if (!configPath) {
    return DEFAULT_CLASP_IGNORE;
  }
  let content = fs.readFileSync(configPath, {encoding: 'utf8'});
  content = stripBom(content);
  return splitLines(content).filter((name: string) => name.length > 0);
}

function loadManifest(contentDir: string) {
  const manifestPath = path.join(contentDir, 'appsscript.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  const manifestContent = fs.readFileSync(manifestPath, {encoding: 'utf8'});
  return JSON.parse(manifestContent);
}
