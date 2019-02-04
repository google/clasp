import { readFileSync } from 'fs';
import * as path from 'path';
/**
 * Clasp command method bodies.
 */
import chalk from 'chalk';
import * as commander from 'commander';
import * as del from 'del';
import * as pluralize from 'pluralize';
import { watchTree } from 'watch';
import { PUBLIC_ADVANCED_SERVICES } from './apis';
import {
  enableAppsScriptAPI,
  enableOrDisableAPI,
  getFunctionNames,
} from './apiutils';
import {
  authorize,
  discovery,
  drive,
  getLocalScript,
  loadAPICredentials,
  logger,
  script,
  serviceUsage,
} from './auth';
import { DOT, DOTFILE, ProjectSettings } from './dotfile';
import { fetchProject, getProjectFiles, pushFiles } from './files';
import {
  addScopeToManifest,
  isValidManifest,
  readManifest,
} from './manifest';
import { URL } from './urls';
import {
  ERROR,
  LOG,
  PROJECT_MANIFEST_BASENAME,
  PROJECT_MANIFEST_FILENAME,
  checkIfOnline,
  getProjectId,
  getProjectSettings,
  hasOauthClientSettings,
  logError,
  spinner,
} from './utils';
import multimatch = require('multimatch');

const ellipsize = require('ellipsize');
const open = require('opn');
const inquirer = require('inquirer');
const padEnd = require('string.prototype.padend');

// setup inquirer
const prompt = inquirer.prompt;
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Uploads all files into the script.google.com filesystem.
 * TODO: Only push the specific files that changed (rather than all files).
 * @param cmd.watch {boolean} If true, runs `clasp push` when any local file changes. Exit with ^C.
 */
export const push = async (cmd: { watch: boolean, force: boolean }) => {
  await checkIfOnline();
  await loadAPICredentials();
  await isValidManifest();
  const { rootDir } = await getProjectSettings();

  /**
   * Checks if the manifest has changes.
   */
  const manifestHasChanges = async (): Promise<boolean> => {
    const { scriptId, rootDir } = await getProjectSettings();
    const localManifestPath = path.join(rootDir || DOT.PROJECT.DIR, PROJECT_MANIFEST_FILENAME);
    const localManifest = readFileSync(localManifestPath, 'utf8');
    const remoteFiles = await fetchProject(scriptId, undefined, true);
    const remoteManifest = remoteFiles.find((file) => file.name === PROJECT_MANIFEST_BASENAME);
    if (!remoteManifest) throw Error('remote manifest no found');
    return localManifest !== remoteManifest.source;
  };

  const confirmManifestUpdate = async (): Promise<boolean> => {
    const answers = await prompt([{
      name: 'overwrite',
      type: 'confirm',
      message: 'Manifest file has been updated. Do you want to push and overwrite?',
      default: false,
    }]) as { overwrite: boolean };
    return answers.overwrite;
  };

  if (cmd.watch) {
    console.log(LOG.PUSH_WATCH);
    const patterns = await DOTFILE.IGNORE();
    // @see https://www.npmjs.com/package/watch
    watchTree(rootDir || '.', async (f, curr, prev) => {
      // The first watch doesn't give a string for some reason.
      if (typeof f === 'string') {
        console.log(`\n${LOG.PUSH_WATCH_UPDATED(f)}\n`);
        if (multimatch([f], patterns).length) {
          // The file matches the ignored files patterns so we do nothing
          return;
        }
      }
      if (!cmd.force && await manifestHasChanges() && !await confirmManifestUpdate()) {
        console.log('Stopping push...');
        return;
      }
      console.log(LOG.PUSHING);
      pushFiles();
    });
  } else {
    if (!cmd.force && await manifestHasChanges() && !await confirmManifestUpdate()) {
      console.log('Stopping push...');
      return;
    }
    spinner.setSpinnerTitle(LOG.PUSHING).start();
    pushFiles();
  }
};

/**
 * Outputs the help command.
 */
export const help = async () => {
  commander.outputHelp();
  process.exit(0);
};

/**
 * Displays a default message when an unknown command is typed.
 * @param command {string} The command that was typed.
 */
export const defaultCmd = async (command: string) => {
  logError(null, ERROR.COMMAND_DNE(command));
};

/**
 * Logs the user in. Saves the client credentials to an either local or global rc file.
 * @param {object} options The login options.
 * @param {boolean?} options.localhost If true, authorizes without a HTTP server.
 * @param {string?} options.creds The location of credentials file.
 */
export const login = async (options: { localhost?: boolean; creds?: string }) => {
  // Local vs global checks
  const isLocalLogin = !!options.creds;
  const loggedInLocal = hasOauthClientSettings(true);
  const loggedInGlobal = hasOauthClientSettings(false);
  if (isLocalLogin && loggedInLocal) console.error(ERROR.LOGGED_IN_LOCAL);
  if (!isLocalLogin && loggedInGlobal) console.error(ERROR.LOGGED_IN_GLOBAL);
  console.log(LOG.LOGIN(isLocalLogin));
  await checkIfOnline();

  // Localhost check
  const useLocalhost = !!options.localhost;

  // Using own credentials.
  if (options.creds) {
    let oauthScopes: string[] = [];
    // First read the manifest to detect any additional scopes in "oauthScopes" fields.
    // In the script.google.com UI, these are found under File > Project Properties > Scopes
    const manifest = await readManifest();
    oauthScopes = manifest.oauthScopes || [];
    oauthScopes = oauthScopes.concat([
      'https://www.googleapis.com/auth/script.webapp.deploy', // Scope needed for script.run
    ]);
    console.log('');
    console.log(`Authorizing with the following scopes:`);
    oauthScopes.map((scope) => {
      console.log(scope);
    });
    console.log('');
    console.log(`NOTE: The full list of scopes you're project may need` +
    ` can be found at script.google.com under:`);
    console.log(`File > Project Properties > Scopes`);
    console.log('');

    // Read credentials file.
    const credsFile = readFileSync(options.creds, 'utf8');
    const credentials = JSON.parse(credsFile);
    await authorize({
      useLocalhost,
      creds: credentials,
      scopes: oauthScopes,
    });
    await enableAppsScriptAPI();
  } else {
    // Not using own credentials
    await authorize({
      useLocalhost,
      scopes: [
        // Use the default scopes needed for clasp.
        'https://www.googleapis.com/auth/script.deployments', // Apps Script deployments
        'https://www.googleapis.com/auth/script.projects', // Apps Script management
        'https://www.googleapis.com/auth/script.webapp.deploy', // Apps Script Web Apps
        'https://www.googleapis.com/auth/drive.metadata.readonly', // Drive metadata
        'https://www.googleapis.com/auth/drive.file', // Create Drive files
        'https://www.googleapis.com/auth/service.management', // Cloud Project Service Management API
        'https://www.googleapis.com/auth/logging.read', // StackDriver logs

        // Extra scope since service.management doesn't work alone
        'https://www.googleapis.com/auth/cloud-platform',
      ],
    });
  }
  process.exit(0); // gracefully exit after successful login
};

/**
 * Logs out the user by deleting credentials.
 */
export const logout = async () => {
  if (hasOauthClientSettings(true)) del(DOT.RC.ABSOLUTE_LOCAL_PATH, { force: true });
  // del doesn't work with a relative path (~)
  if (hasOauthClientSettings()) del(DOT.RC.ABSOLUTE_PATH, { force: true });
};

/**
 * Prints StackDriver logs from this Apps Script project.
 * @param cmd.json {boolean} If true, the command will output logs as json.
 * @param cmd.open {boolean} If true, the command will open the StackDriver logs website.
 * @param cmd.setup {boolean} If true, the command will help you setup logs.
 * @param cmd.watch {boolean} If true, the command will watch for logs and print them. Exit with ^C.
 */
export const logs = async (cmd: { json: boolean; open: boolean; setup: boolean; watch: boolean }) => {
  await checkIfOnline();
  /**
   * This object holds all log IDs that have been printed to the user.
   * This prevents log entries from being printed multiple times.
   * StackDriver isn't super reliable, so it's easier to get generous chunk of logs and filter them
   * rather than filter server-side.
   * @see logs.data.entries[0].insertId
   */
  const logEntryCache: { [key: string]: boolean } = {};

  /**
   * Prints log entries
   * @param entries {any[]} StackDriver log entries.
   */
  function printLogs(entries: any[] = []): void {
    entries = entries.reverse(); // print in syslog ascending order
    for (let i = 0; i < 50 && entries ? i < entries.length : i < 0; ++i) {
      const { severity, timestamp, resource, textPayload, protoPayload, jsonPayload, insertId } = entries[i];
      let functionName = resource.labels.function_name;
      functionName = functionName ? padEnd(functionName, 15) : ERROR.NO_FUNCTION_NAME;
      let payloadData: any = '';
      if (cmd.json) {
        payloadData = JSON.stringify(entries[i], null, 2);
      } else {
        const data: any = {
          textPayload,
          // chokes on unmatched json payloads
          // jsonPayload: jsonPayload ? jsonPayload.fields.message.stringValue : '',
          jsonPayload: jsonPayload ? JSON.stringify(jsonPayload).substr(0, 255) : '',
          protoPayload,
        };
        payloadData = data.textPayload || data.jsonPayload || data.protoPayload || ERROR.PAYLOAD_UNKNOWN;
        if (payloadData && payloadData['@type'] === 'type.googleapis.com/google.cloud.audit.AuditLog') {
          payloadData = LOG.STACKDRIVER_SETUP;
          functionName = padEnd(protoPayload.methodName, 15);
        }
        if (payloadData && typeof payloadData === 'string') {
          payloadData = padEnd(payloadData, 20);
        }
      }
      const coloredStringMap: any = {
        ERROR: chalk.red(severity),
        INFO: chalk.cyan(severity),
        DEBUG: chalk.green(severity), // includes timeEnd
        NOTICE: chalk.magenta(severity),
        WARNING: chalk.yellow(severity),
      };
      let coloredSeverity: string = coloredStringMap[severity] || severity;
      coloredSeverity = padEnd(String(coloredSeverity), 20);
      // If we haven't logged this entry before, log it and mark the cache.
      if (!logEntryCache[insertId]) {
        console.log(`${coloredSeverity} ${timestamp} ${functionName} ${payloadData}`);
        logEntryCache[insertId] = true;
      }
    }
  }
  async function setupLogs(projectId?: string): Promise<string> {
    const promise = new Promise<string>((resolve, reject) => {
      getProjectSettings().then(projectSettings => {
        console.log(`Open this link: ${LOG.SCRIPT_LINK(projectSettings.scriptId)}\n`);
        console.log(`Go to *Resource > Cloud Platform Project...* and copy your projectId
(including "project-id-")\n`);
        prompt([
          {
            type: 'input',
            name: 'projectId',
            message: 'What is your GCP projectId?',
          },
        ])
          .then(async (answers: any) => {
            projectId = answers.projectId;
            const dotfile = await DOTFILE.PROJECT();
            if (!dotfile) return reject(logError(null, ERROR.SETTINGS_DNE));
            dotfile
              .read()
              .then((settings: ProjectSettings) => {
                if (!settings.scriptId) logError(ERROR.SCRIPT_ID_DNE);
                dotfile.write(Object.assign(settings, { projectId }));
                resolve(projectId);
              })
              .catch((err: object) => {
                reject(logError(err));
              });
          })
          .catch((err: any) => {
            reject(console.log(err));
          });
      });
    });
    promise.catch(err => {
      logError(err);
      spinner.stop(true);
    });
    return promise;
  }
  // Get project settings.
  let { projectId } = await getProjectSettings();
  projectId = cmd.setup ? await setupLogs() : projectId;
  if (!projectId) {
    console.log(LOG.NO_GCLOUD_PROJECT);
    projectId = await setupLogs();
    console.log(LOG.LOGS_SETUP);
  }
  // If we're opening the logs, get the URL, open, then quit.
  if (cmd.open) {
    const url = URL.LOGS(projectId);
    console.log(`Opening logs: ${url}`);
    return open(url, { wait: false });
  }

  /**
   * Fetches the logs and prints the to the user.
   * @param startDate {Date?} Get logs from this date to now.
   */
  async function fetchAndPrintLogs(startDate?: Date): Promise<void> {
    spinner.setSpinnerTitle(`${oauthSettings.isLocalCreds ? LOG.LOCAL_CREDS : ''}${LOG.GRAB_LOGS}`).start();
    // Create a time filter (timestamp >= "2016-11-29T23:00:00Z")
    // https://cloud.google.com/logging/docs/view/advanced-filters#search-by-time
    let filter = '';
    if (startDate) {
      filter = `timestamp >= "${startDate.toISOString()}"`;
    }
    const logs = await logger.entries.list({
      requestBody: {
        resourceNames: [`projects/${projectId}`],
        filter,
        orderBy: 'timestamp desc',
      },
    });

    // We have an API response. Now, check the API response status.
    spinner.stop(true);
    // Only print filter if provided.
    if (filter.length) {
      console.log(filter);
    }
    if (logs.status !== 200) {
      switch (logs.status) {
        case 401:
          logError(null, oauthSettings.isLocalCreds ? ERROR.UNAUTHENTICATED_LOCAL : ERROR.UNAUTHENTICATED);
        case 403:
          logError(
            null,
            oauthSettings.isLocalCreds ? ERROR.PERMISSION_DENIED_LOCAL : ERROR.PERMISSION_DENIED,
          );
        default:
          logError(null, `(${logs.status}) Error: ${logs.statusText}`);
      }
    } else {
      printLogs(logs.data.entries);
    }
  }

  // Otherwise, if not opening StackDriver, load StackDriver logs.
  const oauthSettings = await loadAPICredentials();
  if (cmd.watch) {
    const POLL_INTERVAL = 6000; // 6s
    setInterval(() => {
      const startDate = new Date();
      startDate.setSeconds(startDate.getSeconds() - (10 * POLL_INTERVAL) / 1000);
      fetchAndPrintLogs(startDate);
    }, POLL_INTERVAL);
  } else {
    fetchAndPrintLogs();
  }
};

/**
 * Executes an Apps Script function. Requires clasp login --creds.
 * @param functionName {string} The function name within the Apps Script project.
 * @param cmd.nondev {boolean} If we want to run the last deployed version vs the latest code.
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 * @requires `clasp login --creds` to be run beforehand.
 */
export const run = async (functionName: string, cmd: { nondev: boolean; params: string }) => {
  const IS_VALID_JSON_STRING = (str: string):boolean => {
    try {
      JSON.parse(str);
    } catch (error) {
      throw new Error('Error: Input params not Valid JSON string. Please fix and try again');
    }
    return true;
  };

  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings(true);
  const devMode = !cmd.nondev; // defaults to true
  const { params: paramString = '[]' } = cmd;
  IS_VALID_JSON_STRING(paramString);
  const params = JSON.parse(paramString);
  // Ensures the manifest is correct for running a function.
  // The manifest must include:
  // "executionApi": {
  //   "access": "MYSELF"
  // }
  await isValidManifest();

  // TODO COMMENT THIS. This uses a method that gives a HTML 404.
  // await enableExecutionAPI();

  // Pushes the latest code if in dev mode.
  // We need to update the manifest before executing to:
  // - Ensure the execution API is enambled.
  // - Ensure we can run functions that were developed locally but not pushed.
  if (devMode) {
    // TODO enable this once we can properly await pushFiles
    // await pushFiles(true);
  }

  // Get the list of functions.
  if (!functionName) functionName = await getFunctionNames(script, scriptId);

  /**
   * Runs a function.
   * @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#response-body
   */
  const RUN_FUNCTION = async (functionName: string, params: any[]) => {
    try {
      // Load local credentials.
      await loadAPICredentials(true);
      const localScript = await getLocalScript();
      spinner.setSpinnerTitle(`Running function: ${functionName}`).start();
      const res = await localScript.scripts.run({
        scriptId,
        requestBody: {
          function: functionName,
          parameters: params,
          devMode,
        },
      });
      spinner.stop(true);
      if (!res || !res.data.done) {
        logError(null, ERROR.RUN_NODATA);
        process.exit(0); // exit gracefully in case localhost server spun up for authorize
      }
      const data = res.data;
      // @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#response-body
      if (data.response) {
        if (data.response.result) {
          console.log(data.response.result);
        } else {
          console.log(chalk.red('No response.'));
        }
      } else if (data.error && data.error.details) {
        // @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run#Status
        console.error(
          `${chalk.red('Exception:')}`,
          data.error.details[0].errorType,
          data.error.details[0].errorMessage,
          data.error.details[0].scriptStackTraceElements || [],
        );
      }
    } catch (err) {
      spinner.stop(true);
      if (err) {
        // TODO move these to logError when stable?
        switch (err.code) {
          case 401:
            // The 401 is probably due to this error:
            // "Error: Local client credentials unauthenticated. Check scopes/authorization.""
            // This is probably due to the OAuth client not having authorized scopes.
            console.log(`` +
              `Hey! It looks like you aren't authenticated for the scopes required by this script.
Please enter the scopes by doing the following:
1. Open Your Script: ${URL.SCRIPT(scriptId)}
2. File > Project Properties > Scopes
3. Copy/Paste the list of scopes here:
              ~ Example ~
https://mail.google.com/
https://www.googleapis.com/auth/presentations
----(When you're done, press <Enter> 2x)----`);
            // Example scopes:
            // https://mail.google.com/
            // https://www.googleapis.com/auth/presentations
            // https://www.googleapis.com/auth/spreadsheets
            const readline = require('readline');
            const scopes:string[] = [];
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: '',
            });
            rl.prompt();
            rl.on('line', (cmd: string) => {
              if (cmd === '') {
                rl.close();
              } else {
                scopes.push(cmd);
              }
            });
            rl.on('close', async () => {
              await addScopeToManifest(scopes);
              const numScopes = scopes.length;
              console.log(`Added ${numScopes} ` +
                `${pluralize('scope', numScopes)} to your appsscript.json' oauthScopes`);
              console.log('Please `clasp login --creds <file>` to log in with these new scopes.');
            });
            // We probably don't need to show the unauth error
            // since we always prompt the user to fix this now.
            // logError(null, ERROR.UNAUTHENTICATED_LOCAL);
            break;
          case 403:
            logError(null, ERROR.PERMISSION_DENIED_LOCAL);
            break;
          case 404:
            logError(null, ERROR.EXECUTE_ENTITY_NOT_FOUND);
            break;
          default:
            logError(null, `(${err.code}) Error: ${err.message}`);
        }
      }
    }
  };
  await RUN_FUNCTION(functionName, params);
};

/**
 * Deploys an Apps Script project.
 * @param cmd.versionNumber {string} The project version to deploy at.
 * @param cmd.desc {string} The deployment description.
 * @param cmd.deploymentId  {string} The deployment ID to redeploy.
 */
export const deploy = async (cmd: { versionNumber: number; description: string; deploymentId: string }) => {
  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings();
  if (!scriptId) return;
  spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId)).start();
  let { versionNumber } = cmd;
  const { description = '', deploymentId } = cmd;

  // if no version, create a new version
  if (!versionNumber) {
    const version = await script.projects.versions.create({
      scriptId,
      requestBody: {
        description,
      },
    });
    spinner.stop(true);
    if (version.status !== 200) {
      return logError(null, ERROR.ONE_DEPLOYMENT_CREATE);
    }
    versionNumber = version.data.versionNumber || 0;
    console.log(LOG.VERSION_CREATED(versionNumber));
  }

  spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
  let deployments;
  if (!deploymentId) {
    // if no deploymentId, create a new deployment
    deployments = await script.projects.deployments.create({
      scriptId,
      requestBody: {
        versionNumber,
        manifestFileName: PROJECT_MANIFEST_BASENAME,
        description,
      },
    });
  } else {
    // elseif, update deployment
    deployments = await script.projects.deployments.update({
      scriptId,
      deploymentId,
      requestBody: {
        deploymentConfig: {
          versionNumber,
          manifestFileName: PROJECT_MANIFEST_BASENAME,
          description,
        },
      },
    });
  }
  spinner.stop(true);
  if (deployments.status !== 200) {
    logError(null, ERROR.DEPLOYMENT_COUNT);
  } else {
    console.log(`- ${deployments.data.deploymentId} @${versionNumber}.`);
  }
};

/**
 * Removes a deployment from the Apps Script project.
 * @param deploymentId {string} The deployment's ID
 */
export const undeploy = async (deploymentId: string, cmd: { all: boolean }) => {
  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings();
  if (!scriptId) return;
  if (cmd.all){
    const deploymentsList = await script.projects.deployments.list({
      scriptId,
    });
    if (deploymentsList.status !== 200) {
      return logError(deploymentsList.statusText);
    }
    const deployments = deploymentsList.data.deployments || [];
    if (!deployments.length) {
      logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }
    deployments.shift(); // @HEAD (Read-only deployments) may not be deleted.
    for(const deployment of deployments){
      const deploymentId = deployment.deploymentId || '';
      spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
      const result = await script.projects.deployments.delete({
        scriptId,
        deploymentId,
      });
      spinner.stop(true);
      if (result.status !== 200) {
        return logError(null, ERROR.READ_ONLY_DELETE);
      }
      console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
    }
    console.log(LOG.UNDEPLOYMENT_ALL_FINISH);
    return;
  }
  if (!deploymentId) {
    const deploymentsList = await script.projects.deployments.list({
      scriptId,
    });
    if (deploymentsList.status !== 200) {
      return logError(deploymentsList.statusText);
    }
    const deployments = deploymentsList.data.deployments || [];
    if (!deployments.length) {
      logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
    }
    if (deployments.length <= 1) {
      // @HEAD (Read-only deployments) may not be deleted.
      logError(null, ERROR.NO_VERSIONED_DEPLOYMENTS);
    }
    deploymentId = deployments[deployments.length - 1].deploymentId || '';
  }
  spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
  const deployment = await script.projects.deployments.delete({
    scriptId,
    deploymentId,
  });
  spinner.stop(true);
  if (deployment.status !== 200) {
    return logError(null, ERROR.READ_ONLY_DELETE);
  } else {
    console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
  }
};

/**
 * Lists a user's Apps Script projects using Google Drive.
 */
export const list = async () => {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.setSpinnerTitle(LOG.FINDING_SCRIPTS).start();
  const filesList = await drive.files.list({
    pageSize: 50,
    // fields isn't currently supported
    // https://github.com/googleapis/google-api-nodejs-client/issues/1374
    // fields: 'nextPageToken, files(id, name)',
    q: 'mimeType="application/vnd.google-apps.script"',
  });
  spinner.stop(true);
  if (filesList.status !== 200) {
    return logError(null, ERROR.DRIVE);
  }
  const files = filesList.data.files || [];
  if (!files.length) {
    return console.log(LOG.FINDING_SCRIPTS_DNE);
  }
  const NAME_PAD_SIZE = 20;
  files.map((file: any) => {
    console.log(`${padEnd(ellipsize(file.name, NAME_PAD_SIZE), NAME_PAD_SIZE)} – ${URL.SCRIPT(file.id)}`);
  });
};

/**
 * Lists a script's deployments.
 */
export const deployments = async () => {
  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings();
  if (!scriptId) return;
  spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId)).start();
  const deployments = await script.projects.deployments.list({
    scriptId,
  });
  spinner.stop(true);
  if (deployments.status !== 200) {
    return logError(deployments.statusText);
  }
  const deploymentsList = deployments.data.deployments || [];
  const numDeployments = deploymentsList.length;
  const deploymentWord = pluralize('Deployment', numDeployments);
  console.log(`${numDeployments} ${deploymentWord}.`);
  deploymentsList.map(({ deploymentId, deploymentConfig }: any) => {
    const versionString = !!deploymentConfig.versionNumber ? `@${deploymentConfig.versionNumber}` : '@HEAD';
    const description = deploymentConfig.description ? '- ' + deploymentConfig.description : '';
    console.log(`- ${deploymentId} ${versionString} ${description}`);
  });
};

/**
 * Lists versions of an Apps Script project.
 */
export const versions = async () => {
  await checkIfOnline();
  await loadAPICredentials();
  spinner.setSpinnerTitle('Grabbing versions...').start();
  const { scriptId } = await getProjectSettings();
  const versions = await script.projects.versions.list({
    scriptId,
    pageSize: 500,
  });
  spinner.stop(true);
  if (versions.status !== 200) {
    return logError(versions.statusText);
  }
  const data = versions.data;
  if (!data || !data.versions || !data.versions.length) {
    return logError(null, LOG.DEPLOYMENT_DNE);
  }
  const numVersions = data.versions.length;
  console.log(LOG.VERSION_NUM(numVersions));
  data.versions.reverse().map((version: any) => {
    console.log(LOG.VERSION_DESCRIPTION(version));
  });
};

/**
 * Creates a new version of an Apps Script project.
 */
export const version = async (description: string) => {
  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings();
  if (!description) {
    const answers = await prompt([
      {
        type: 'input',
        name: 'description',
        message: LOG.GIVE_DESCRIPTION,
        default: '',
      },
    ]);
    description = answers.description;
  }
  spinner.setSpinnerTitle(LOG.VERSION_CREATE).start();
  const versions = await script.projects.versions.create({
    scriptId,
    requestBody: {
      description,
    },
  });
  spinner.stop(true);
  if (versions.status !== 200) {
    return logError(versions.statusText);
  }
  console.log(LOG.VERSION_CREATED(versions.data.versionNumber || -1));
};

/**
 * Displays the status of which Apps Script files are ignored from .claspignore
 * @param cmd.json {boolean} Displays the status in json format.
 */
export const status = async (cmd: { json: boolean }) => {
  await checkIfOnline();
  await isValidManifest();
  const { scriptId, rootDir } = await getProjectSettings();
  if (!scriptId) return;
  const projectFiles = await getProjectFiles(rootDir);
  if (projectFiles) {
    // const [filesToPush, untrackedFiles] = projectFiles;
    const [filesToPush, untrackedFiles] = [[],[]];
    if (cmd.json) {
      console.log(JSON.stringify({ filesToPush, untrackedFiles }));
    } else {
      console.log(LOG.STATUS_PUSH);
      filesToPush.forEach((file: any) => console.log(`└─ ${file}`));
      console.log(); // Separate Ignored files list.
      console.log(LOG.STATUS_IGNORE);
      untrackedFiles.forEach((file: any) => console.log(`└─ ${file}`));
    }
  }
};

/**
 * Acts as a router to apis subcommands
 * Calls functions for list, enable, or disable
 * Otherwise returns an error of command not supported
 */
export const apis = async (options: { open?: string }) => {
  await loadAPICredentials();
  const subcommand: string = process.argv[3]; // clasp apis list => "list"
  const serviceName = process.argv[4]; // clasp apis enable drive => "drive"

  // clasp apis --open
  if (options.open) {
    const apisUrl = URL.APIS(await getProjectId());
    console.log(apisUrl);
    return open(apisUrl, { wait: false });
  }

  // The apis subcommands.
  const command: { [key: string]: Function } = {
    enable: async () => {
      enableOrDisableAPI(serviceName, true);
    },
    disable: async () => {
      enableOrDisableAPI(serviceName, false);
    },
    list: async () => {
      await checkIfOnline();
      /**
       * List currently enabled APIs.
       */
      console.log('\n# Currently enabled APIs:');
      const projectId = await getProjectId(); // will prompt user to set up if required
      const MAX_PAGE_SIZE = 200; // This is the max page size according to the docs.
      const list = await serviceUsage.services.list({
        parent: `projects/${projectId}`,
        filter: 'state:ENABLED',
        pageSize: MAX_PAGE_SIZE,
      });
      const serviceList = list.data.services || [];
      if (serviceList.length >= MAX_PAGE_SIZE) {
        console.log('Uh oh. It looks like Grant did not add pagination. Please create a bug.');
      }

      // Filter out the disabled ones. Print the enabled ones.
      const enabledAPIs = serviceList.filter(service => {
        return service.state === 'ENABLED';
      });
      for (const enabledAPI of enabledAPIs) {
        if (enabledAPI.config && enabledAPI.config.documentation) {
          const name = enabledAPI.config.name || 'Unknown name.';
          console.log(`${name.substr(0, name.indexOf('.'))} - ${enabledAPI.config.documentation.summary}`);
        }
      }

      /**
       * List available APIs.
       */
      console.log('\n# List of available APIs:');
      const { data } = await discovery.apis.list({
        preferred: true,
      });
      const services = data.items || [];
      // Only get the public service IDs
      const PUBLIC_ADVANCED_SERVICE_IDS = PUBLIC_ADVANCED_SERVICES.map(
        advancedService => advancedService.serviceId,
      );

      // Merge discovery data with public services data.
      const publicServices = [];
      for (const publicServiceId of PUBLIC_ADVANCED_SERVICE_IDS) {
        const service: any = services.find(s => s.name === publicServiceId);
        // for some reason 'youtubePartner' is not in the api list.
        if (service && service.id && service.description) {
          publicServices.push(service);
        }
      }

      // Sort the services based on id
      publicServices.sort((a: any, b: any) => {
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      });

      // Format the list
      for (const api of publicServices) {
        console.log(`${padEnd(api.name, 25)} - ${padEnd(api.description, 60)}`);
      }
    },
    undefined: () => {
      command.list();

      console.log(`# Try these commands:
- clasp apis list
- clasp apis enable slides
- clasp apis disable slides`);
    },
  };
  if (command[subcommand]) {
    command[subcommand]();
  } else {
    logError(null, ERROR.COMMAND_DNE('apis ' + subcommand));
  }
};
