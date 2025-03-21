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

export type InitOptions = {
  credentials?: OAuth2Client;
  configFile?: string;
  ignoreFile?: string;
};

export class Clasp {
  private options: ClaspOptions;
  readonly services: Services;
  readonly files: Files;
  readonly project: Project;
  readonly logs: Logs;
  readonly functions: Functions;

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

  withScriptId(scriptId: string) {
    if (this.options.project) {
      throw new Error('Science project already set, create new instance instead');
    }

    this.options.project = {
      scriptId,
    };
    return this;
  }

  withContentDir(contentDir: string) {
    if (!path.isAbsolute(contentDir)) {
      contentDir = path.resolve(this.options.files.projectRootDir, contentDir);
    }
    this.options.files.contentDir = contentDir;
    return this;
  }
}

export async function initClaspInstance(options: InitOptions): Promise<Clasp> {
  debug('Initializing clasp instance');
  const projectRoot = await findProjectRootdDir(options.configFile);
  if (!projectRoot) {
    debug('No project found, defaulting to cwd');
    const rootDir = path.resolve(process.cwd());
    const configFilePath = path.resolve(rootDir, '.clasp.json');
    const ignoreFile = await findIgnoreFile(rootDir, options.ignoreFile);
    const ignoreRules = await loadIgnoreFileOrDefaults(ignoreFile);
    return new Clasp({
      credentials: options.credentials,
      configFilePath,
      files: {
        projectRootDir: rootDir,
        contentDir: rootDir,
        ignoreFilePath: ignoreFile,
        ignorePatterns: ignoreRules,
        filePushOrder: [],
        skipSubdirectories: false,
        fileExtensions: readFileExtensions({}),
      },
    });
  }

  debug('Project config found at %s', projectRoot.configPath);
  const ignoreFile = await findIgnoreFile(projectRoot.rootDir, options.ignoreFile);
  const ignoreRules = await loadIgnoreFileOrDefaults(ignoreFile);

  const content = await fs.readFile(projectRoot.configPath, {encoding: 'utf8'});
  const config = JSON.parse(content);
  const fileExtensions = readFileExtensions(config);
  const filePushOrder = config.filePushOrder || [];
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
      skipSubdirectories: config.ignoreSubdirectories,
    },
    project: {
      scriptId: config.scriptId,
      projectId: config.projectId,
      parentId: firstValue(config.parentId),
    },
  });
}

function readFileExtensions(config: any | undefined) {
  let scriptExtensions = ['js', 'gs'];
  let htmlExtensions = ['html'];
  let jsonExtensions = ['json'];
  if (config?.fileExtension) {
    // legacy fileExtension setting
    scriptExtensions = [config.fileExtension];
  }
  if (config?.scriptExtensions) {
    scriptExtensions = ensureStringArray(config.scriptExtensions);
  }
  if (config?.htmlExtensions) {
    htmlExtensions = ensureStringArray(config.htmlExtensions);
  }
  if (config?.jsonExtensions) {
    jsonExtensions = ensureStringArray(config.jsonExtensions);
  }
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
    const info = await fs.stat(configFilePath);
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
    const info = await fs.stat(configFilePath);
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
