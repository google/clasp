import {drive_v3 as driveV3, google} from 'googleapis';

import {Command, OptionValues} from 'commander';
import {OAuth2Client} from 'google-auth-library';
import inquirer from 'inquirer';

import path from 'path';
import {ClaspError} from '../clasp-error.js';
import {Context, DEFAULT_CLASP_IGNORE, Project, assertAuthenticated, makeClaspConfigFileName} from '../context.js';
import {fetchProject, writeProjectFiles} from '../files.js';
import {ERROR, LOG} from '../messages.js';
import {extractScriptId} from '../urls.js';
import {checkIfOnlineOrDie, saveProject, spinner, stopSpinner} from '../utils.js';
import {showFileStatusCommand} from './status.js';

/**
 * Fetches an Apps Script project.
 * Prompts the user if no script ID is provided.
 * @param scriptId {string} The Apps Script project ID or project URL to fetch.
 * @param versionNumber {string} An optional version to pull the script from.
 * @param options.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                        If not specified, clasp will default to the current directory.
 */
export async function cloneProjectCommand(
  this: Command,
  scriptId: string | undefined,
  versionNumber: number | undefined,
): Promise<void> {
  await checkIfOnlineOrDie();

  const context: Context = this.opts().context;
  assertAuthenticated(context);

  if (context.project) {
    throw new ClaspError(ERROR.FOLDER_EXISTS(context.project.configFilePath));
  }

  if (scriptId) {
    scriptId = extractScriptId(scriptId);
  } else {
    scriptId = await getScriptId(context.credentials);
  }

  const opts = this.optsWithGlobals();
  const project = initProjectFromCommandOptions(opts, scriptId);
  context.project = project;
  spinner.start(LOG.CLONING);
  try {
    const files = await fetchProject(context.credentials, scriptId, versionNumber);
    await saveProject(context.project);
    await writeProjectFiles(files, context.project);
  } finally {
    stopSpinner();
  }
  await showFileStatusCommand.call(this);
}

export function initProjectFromCommandOptions(opts: OptionValues, scriptId: string): Project {
  if (opts.project) {
    console.log(`Ignoring project option (${opts.project} during clone. Writing to current directory.`);
  }
  if (opts.ignore) {
    console.log(`Ignoring ignore file option (${opts.ignore} during clone.`);
  }
  const projectRootDir = process.cwd();
  const absoluteSrcDir = path.resolve(projectRootDir, opts.rootDir ?? '.');
  const srcDir = path.relative(projectRootDir, absoluteSrcDir);
  if (srcDir.startsWith('..')) {
    throw new ClaspError('Root directory cannot be outside of the current directory.');
  }
  const fileName = makeClaspConfigFileName(opts.env);
  const configFilePath = path.resolve(projectRootDir, fileName);

  const project = {
    projectRootDir: projectRootDir,
    contentDir: absoluteSrcDir,
    configFilePath,
    settings: {
      scriptId,
      srcDir: srcDir?.length ? srcDir : '.',
    },
    ignorePatterns: DEFAULT_CLASP_IGNORE,
  };
  return project;
}

/**
 * Lists a user's AppsScripts and prompts them to choose one to clone.
 */
async function getScriptId(oauth2Client: OAuth2Client): Promise<string> {
  const drive = google.drive({version: 'v3', auth: oauth2Client});

  const {data, statusText} = await drive.files.list({
    fields: 'files(id, name)',
    orderBy: 'modifiedByMeTime desc',
    pageSize: 20,
    q: 'mimeType="application/vnd.google-apps.script"',
  });

  if (!data) {
    throw new ClaspError(statusText ?? 'Unable to use the Drive API.');
  }

  const files = data.files ?? [];

  if (files.length > 0) {
    const choices = files.map((file: Readonly<driveV3.Schema$File>) => ({
      name: `${file.name!.padEnd(20)} - ${LOG.SCRIPT_LINK(file.id ?? '')}`,
      value: file.id ?? '',
    }));
    const {scriptId} = await inquirer.prompt([
      {
        choices: choices,
        message: LOG.CLONE_SCRIPT_QUESTION,
        name: 'scriptId',
        pageSize: 30,
        type: 'list',
      },
    ]);
    return scriptId;
  }

  throw new ClaspError(LOG.FINDING_SCRIPTS_DNE);
}
