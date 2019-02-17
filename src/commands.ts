import { readFileSync } from 'fs';
/**
 * Clasp command method bodies.
 */
import chalk from 'chalk';
import * as pluralize from 'pluralize';
import { PUBLIC_ADVANCED_SERVICES, SCRIPT_TYPES } from './apis';
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
  script,
  serviceUsage,
} from './auth';
import { fetchProject, hasProject, writeProjectFiles } from './files';
import {
  addScopeToManifest,
  isValidManifest,
  manifestExists,
  readManifest,
} from './manifest';
import { URL } from './urls';
import {
  ERROR,
  LOG,
  PROJECT_MANIFEST_BASENAME,
  checkIfOnline,
  getDefaultProjectName,
  getProjectId,
  getProjectSettings,
  hasOauthClientSettings,
  logError,
  saveProject,
  spinner,
} from './utils';

const open = require('opn');
const inquirer = require('inquirer');
const padEnd = require('string.prototype.padend');

// setup inquirer
const prompt = inquirer.prompt;
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Creates a new Apps Script project.
 * @param cmd.type {string} The type of the Apps Script project.
 * @param cmd.title {string} The title of the Apps Script project's file
 * @param cmd.parentId {string} The Drive ID of the G Suite doc this script is bound to.
 * @param cmd.rootDir {string} Specifies the local directory in which clasp will store your project files.
 *                    If not specified, clasp will default to the current directory.
 */
export const create = async (cmd: { type: string; title: string; parentId: string; rootDir: string }) => {
  // Handle common errors.
  await checkIfOnline();
  if (hasProject()) return logError(null, ERROR.FOLDER_EXISTS);
  await loadAPICredentials();

  // Create defaults.
  const title = cmd.title || getDefaultProjectName();
  let { type } = cmd;
  let { parentId } = cmd;

  if (!type) {
    const answers = await prompt([
      {
        type: 'list',
        name: 'type',
        message: LOG.CLONE_SCRIPT_QUESTION,
        choices: Object.keys(SCRIPT_TYPES).map(key => SCRIPT_TYPES[key as any]),
      },
    ]);
    type = answers.type;
  }

  // Create files with MIME type.
  // https://developers.google.com/drive/api/v3/mime-types
  const DRIVE_FILE_MIMETYPES: { [key: string]: string } = {
    [SCRIPT_TYPES.DOCS]: 'application/vnd.google-apps.document',
    [SCRIPT_TYPES.FORMS]: 'application/vnd.google-apps.form',
    [SCRIPT_TYPES.SHEETS]: 'application/vnd.google-apps.spreadsheet',
    [SCRIPT_TYPES.SLIDES]: 'application/vnd.google-apps.presentation',
  };
  const driveFileType = DRIVE_FILE_MIMETYPES[type];
  if (driveFileType) {
    spinner.setSpinnerTitle(LOG.CREATE_DRIVE_FILE_START(type)).start();
    const driveFile = await drive.files.create({
      requestBody: {
        mimeType: driveFileType,
        name: title,
      },
    });
    parentId = driveFile.data.id || '';
    spinner.stop(true);
    console.log(LOG.CREATE_DRIVE_FILE_FINISH(type, parentId));
  }

  // CLI Spinner
  spinner.setSpinnerTitle(LOG.CREATE_PROJECT_START(title)).start();
  try {
    const { scriptId } = await getProjectSettings(true);
    if (scriptId) {
      logError(null, ERROR.NO_NESTED_PROJECTS);
      process.exit(1);
    }
  } catch (err) {
    // no scriptId (because project doesn't exist)
    // console.log(err);
  }

  // Create a new Apps Script project
  const res = await script.projects.create({
    requestBody: {
      title,
      parentId,
    },
  });
  spinner.stop(true);
  if (res.status !== 200) {
    if (parentId) {
      console.log(res.statusText, ERROR.CREATE_WITH_PARENT);
    }
    logError(res.statusText, ERROR.CREATE);
  } else {
    const createdScriptId = res.data.scriptId || '';
    console.log(LOG.CREATE_PROJECT_FINISH(type, createdScriptId));
    const rootDir = cmd.rootDir;
    saveProject({
      scriptId: createdScriptId,
      rootDir,
    }, false);
    if (!manifestExists()) {
      const files = await fetchProject(createdScriptId); // fetches appsscript.json, o.w. `push` breaks
      writeProjectFiles(files, rootDir); // fetches appsscript.json, o.w. `push` breaks
    }
  }
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
 * Executes an Apps Script function. Requires clasp login --creds.
 * @param functionName {string} The function name within the Apps Script project.
 * @param cmd.nondev {boolean} If we want to run the last deployed version vs the latest code.
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 * @requires `clasp login --creds` to be run beforehand.
 */
export const run = async (functionName: string, cmd: { nondev: boolean; params: string }) => {
  function IsValidJSONString(str: string) {
    try {
      JSON.parse(str);
    } catch (error) {
      throw new Error('Error: Input params not Valid JSON string. Please fix and try again');
    }
    return true;
  }

  await checkIfOnline();
  await loadAPICredentials();
  const { scriptId } = await getProjectSettings(true);
  const devMode = !cmd.nondev; // defaults to true
  const { params: paramString = '[]' } = cmd;
  IsValidJSONString(paramString);
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
  // - Ensure the execution API is enabled.
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
  async function runFunction(functionName: string, params: any[]) {
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
            const scopes: string[] = [];
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
  }
  await runFunction(functionName, params);
};

/**
 * Deploys an Apps Script project.
 * @param cmd.versionNumber {string} The project version to deploy at.
 * @param cmd.description   {string} The deployment description.
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
  if (cmd.all) {
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
    for (const deployment of deployments) {
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
