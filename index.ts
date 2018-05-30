#!/usr/bin/env node
/**
 * @license
 * Copyright Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * clasp – The Apps Script CLI
 */
import 'connect';
const open = require('open');
const path = require('path');
const commander = require('commander');
const chalk = require('chalk');
import * as pluralize from 'pluralize';
import { DOT, PROJECT_NAME, PROJECT_MANIFEST_BASENAME,
    ProjectSettings, DOTFILE, spinner, logError, ERROR, getScriptURL,
    getProjectSettings, getAPIFileType, checkIfOnline,
    saveProjectId, manifestExists } from './src/utils';
import { drive, script, logger, getAPICredentials, login } from './src/auth';
import { LOG, help, defaultCmd,
logout, create, clone} from './src/commands';
import {getProjectFiles, fetchProject, getFileType, hasProject} from './src/files';

// Functions (not yet moved out of this file)
const pull = async () => {
  await checkIfOnline();
  const { scriptId, rootDir } = await getProjectSettings();
  if (scriptId) {
    spinner.setSpinnerTitle(LOG.PULLING);
    fetchProject(scriptId, rootDir);
  }
};
const push = async () => {
  await checkIfOnline();
  spinner.setSpinnerTitle(LOG.PUSHING).start();
  getAPICredentials(async () => {
    const { scriptId, rootDir } = await getProjectSettings();
    if (!scriptId) return;
      getProjectFiles(rootDir, (err, projectFiles, files) => {
        if(err) {
          console.log(err);
          spinner.stop(true);
        } else if (projectFiles) {
          const [nonIgnoredFilePaths] = projectFiles;
          script.projects.updateContent({
            scriptId,
            resource: { files },
          }, {}, (error: any) => {
            spinner.stop(true);
            if (error) {
              console.error(LOG.PUSH_FAILURE);
              error.errors.map((err: any) => {
                console.error(err.message);
              });
              console.error(LOG.FILES_TO_PUSH);
              nonIgnoredFilePaths.map((filePath: string) => {
                console.error(`└─ ${filePath}`);
              });
              process.exit(1);
            } else {
              nonIgnoredFilePaths.map((filePath: string) => {
                console.log(`└─ ${filePath}`);
              });
              console.log(LOG.PUSH_SUCCESS(nonIgnoredFilePaths.length));
            }
        });
      }
    });
  });
};

const status = async (cmd: { json: boolean }) => {
  await checkIfOnline();
  getProjectSettings().then(({ scriptId, rootDir }: ProjectSettings) => {
    if (!scriptId) return;
    getProjectFiles(rootDir, (err, projectFiles) => {
      if(err) return console.log(err);
      else if (projectFiles) {
        const [filesToPush, untrackedFiles] = projectFiles;
        if (cmd.json) {
          console.log(JSON.stringify({ filesToPush, untrackedFiles }));
        } else {
          console.log(LOG.STATUS_PUSH);
          filesToPush.forEach((file) => console.log(`└─ ${file}`));
          console.log(LOG.STATUS_IGNORE);
          untrackedFiles.forEach((file) => console.log(`└─ ${file}`));
        }
      }
    });
  });
};
const openCmd = async (scriptId: any) => {
  if (!scriptId) {
    const settings = await getProjectSettings();
    scriptId = settings.scriptId;
  }
  if (scriptId.length < 30) {
    logError(null, ERROR.SCRIPT_ID_INCORRECT(scriptId));
  } else {
    console.log(LOG.OPEN_PROJECT(scriptId));
    open(getScriptURL(scriptId));
  }
};
const deployments = async () => {
  await checkIfOnline();
  getAPICredentials(async () => {
    const { scriptId } = await getProjectSettings();
    if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.DEPLOYMENT_LIST(scriptId)).start();
      script.projects.deployments.list({
        scriptId,
      }, {}, (error: any, { data }: any) => {
        spinner.stop(true);
        if (error) {
          logError(error);
        } else {
          const deployments = data.deployments;
          const numDeployments = deployments.length;
          const deploymentWord = pluralize('Deployment', numDeployments);
          console.log(`${numDeployments} ${deploymentWord}.`);
          deployments.map(({ deploymentId, deploymentConfig }: any) => {
            const versionString = !!deploymentConfig.versionNumber ?
              `@${deploymentConfig.versionNumber}` : '@HEAD';
            const description = deploymentConfig.description ?
              '- ' + deploymentConfig.description : '';
            console.log(`- ${deploymentId} ${versionString} ${description}`);
          });
        }
      });
  });
};
const deploy = async (version: string, description: string) => {
  await checkIfOnline();
  description = description || '';
  getAPICredentials(async () => {
    const { scriptId } = await getProjectSettings();
    if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.DEPLOYMENT_START(scriptId)).start();
      function createDeployment(versionNumber: string) {
        spinner.setSpinnerTitle(LOG.DEPLOYMENT_CREATE);
        script.projects.deployments.create({
          scriptId,
          resource: {
            versionNumber,
            manifestFileName: PROJECT_MANIFEST_BASENAME,
            description,
          },
        }, {}, (err: any, response: any) => {
          spinner.stop(true);
          if (err) {
            console.error(ERROR.DEPLOYMENT_COUNT);
          } else if (response) {
            console.log(`- ${response.data.deploymentId} @${versionNumber}.`);
          }
        });
      }

      // If the version is specified, update that deployment
      const versionRequestBody = {
        description,
      };
      if (version) {
        createDeployment(version);
      } else { // if no version, create a new version and deploy that
        script.projects.versions.create({
          scriptId,
          resource: versionRequestBody,
        }, {}, (err: any, { data }: any) => {
          spinner.stop(true);
          if (err) {
            logError(null, ERROR.ONE_DEPLOYMENT_CREATE);
          } else {
            console.log(LOG.VERSION_CREATED(data.versionNumber));
            createDeployment(data.versionNumber);
          }
        });
      }
  });
};
const undeploy = async (deploymentId: string) => {
  await checkIfOnline();
  getAPICredentials(() => {
    getProjectSettings().then(({ scriptId }: ProjectSettings) => {
      if (!scriptId) return;
      spinner.setSpinnerTitle(LOG.UNDEPLOYMENT_START(deploymentId)).start();
      script.projects.deployments.delete({
        scriptId,
        deploymentId,
      }, {}, (err: any, res: any) => {
        spinner.stop(true);
        if (err) {
          logError(null, ERROR.READ_ONLY_DELETE);
        } else {
          console.log(LOG.UNDEPLOYMENT_FINISH(deploymentId));
        }
      });
    });
  });
};
const versions = async () => {
  await checkIfOnline();
  spinner.setSpinnerTitle('Grabbing versions...').start();
  getAPICredentials(async () => {
    const { scriptId } = await getProjectSettings();
    script.projects.versions.list({
      scriptId,
    }, {}, (error: any, { data }: any) => {
      spinner.stop(true);
      if (error) {
        logError(error);
      } else {
        if (data && data.versions && data.versions.length) {
          const numVersions = data.versions.length;
          console.log(LOG.VERSION_NUM(numVersions));
          data.versions.map((version: string) => {
            console.log(LOG.VERSION_DESCRIPTION(version));
          });
        } else {
          console.error(LOG.DEPLOYMENT_DNE);
        }
      }
    });
  });
};
const version = async (description: string) => {
  await checkIfOnline();
  spinner.setSpinnerTitle(LOG.VERSION_CREATE).start();
  getAPICredentials(async () => {
    const { scriptId } = await getProjectSettings();
    script.projects.versions.create({
      scriptId,
      description,
    }, {}, (error: any, { data }: any) => {
      spinner.stop(true);
      if (error) {
        logError(error);
      } else {
        console.log(LOG.VERSION_CREATED(data.versionNumber));
      }
    });
  });
};
const list = async () => {
  await checkIfOnline();
  spinner.setSpinnerTitle(LOG.FINDING_SCRIPTS).start();
  getAPICredentials(async () => {
    const res = await drive.files.list({
      pageSize: 50,
      fields: 'nextPageToken, files(id, name)',
      q: 'mimeType="application/vnd.google-apps.script"',
    });
    spinner.stop(true);
    const files = res.data.files;
    if (files.length) {
      files.map((file: any) => {
        console.log(`${file.name.padEnd(20)} – ${getScriptURL(file.id)}`);
      });
    } else {
      console.log('No script files found.');
    }
  });
};
const redeploy = async (deploymentId: string, version: string, description: string) => {
  await checkIfOnline();
  getAPICredentials(() => {
    getProjectSettings().then(({ scriptId }: ProjectSettings) => {
      script.projects.deployments.update({
        scriptId,
        deploymentId,
        resource: {
          deploymentConfig: {
            versionNumber: version,
            manifestFileName: PROJECT_MANIFEST_BASENAME,
            description,
          },
        },
      }, {}, (error: any, res: any) => {
        spinner.stop(true);
        if (error) {
          logError(null, error); // TODO prettier error
        } else {
          console.log(LOG.REDEPLOY_END);
        }
      });
    });
  });
};
const logs = async (cmd: {
  json: boolean,
  open: boolean,
}) => {
  await checkIfOnline();
  function printLogs(entries: any[]) {
    for (let i = 0; i < 50 && i < entries.length; ++i) {
      const { severity, timestamp, resource, textPayload, protoPayload, jsonPayload } = entries[i];
      let functionName = resource.labels.function_name;
      functionName = functionName ? functionName.padEnd(15) : ERROR.NO_FUNCTION_NAME;
      let payloadData: any = '';
      if (cmd.json) {
        payloadData = JSON.stringify(entries[i], null, 2);
      } else {
        const data: any = {
          textPayload,
          jsonPayload: jsonPayload ? jsonPayload.fields.message.stringValue : '',
          protoPayload,
        };
        payloadData = data.textPayload || data.jsonPayload || data.protoPayload || ERROR.PAYLOAD_UNKNOWN;
        if (payloadData && typeof(payloadData) === 'string') {
          payloadData = payloadData.padEnd(20);
        }
      }
      const coloredStringMap: any = {
        ERROR: chalk.red(severity),
        INFO: chalk.blue(severity),
        DEBUG: chalk.yellow(severity),
        NOTICE: chalk.magenta(severity),
      };
      let coloredSeverity:string = coloredStringMap[severity] || severity;
      coloredSeverity = String(coloredSeverity).padEnd(20);
      console.log(`${coloredSeverity} ${timestamp} ${functionName} ${payloadData}`);
    }
  }
  const { projectId } = await getProjectSettings();
  if (!projectId) {
    console.error(ERROR.NO_GCLOUD_PROJECT);
    process.exit(-1);
  }
  if (cmd.open) {
    const url = 'https://console.cloud.google.com/logs/viewer?project=' +
        `${projectId}&resource=app_script_function`;
    console.log(`Opening logs: ${url}`);
    open(url);
    process.exit(0);
  }
  getAPICredentials(async () => {
    const { data } = await logger.entries.list({
      resourceNames: [
        `projects/${projectId}`,
      ],
    });
    printLogs(data.entries);
  });
};
const run = (functionName:string) => {
  getAPICredentials(async () => {
    await checkIfOnline();
    getProjectSettings().then(({ scriptId }: ProjectSettings) => {
      const params = {
        scriptId,
        function: functionName,
        devMode: false,
      };
      script.scripts.run(params).then(response => {
        console.log(response.data);
      }).catch(e => {
        console.log(e);
      });
    });
  });
};

// CLI

/**
 * Set global CLI configurations
 */
commander
  .usage(`${PROJECT_NAME} <command> [options]`)
  .description(`${PROJECT_NAME} - The Apps Script CLI`);

/**
 * Logs the user in. Saves the client credentials to an rc file.
 */
commander
  .command('login')
  .description('Log in to script.google.com')
  .option('--no-localhost', 'Do not run a local server, manually enter code instead')
  .option('--ownkey', 'Save .clasprc.json file to current working directory')
  .action(login);

/**
 * Logs out the user by deleteing client credentials.
 */
commander
  .command('logout')
  .description('Log out')
  .action(logout);

/**
 * Creates a new script project.
 * @param {string} [scriptTitle] An optional project title.
 * @param {string} [scriptParentId] An optional project parent Id. The Drive ID of a parent file
 *   that the created script project is bound to. This is usually the ID of a
 *   Google Doc, Google Sheet, Google Form, or Google Slides file. If not set, a
 *   standalone script project is created.
 * @example `create "My Script" "1D_Gxyv*****************************NXO7o"`
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/projects/create
 */
commander
  .command('create [scriptTitle] [scriptParentId]')
  .description('Create a script')
  .action(create);

/**
 * Fetches a project and saves the script id locally.
 */
commander
  .command('clone [scriptId] [versionNumber]')
  .description('Clone a project')
  .action(clone);

/**
 * Fetches a project from either a provided or saved script id.
 */
commander
  .command('pull')
  .description('Fetch a remote project')
  .action(pull);

/**
 * Force writes all local files to the script management server.
 * Ignores files:
 * - That start with a .
 * - That don't have an accepted file extension
 * - That are ignored (filename matches a glob pattern in the ignore file)
 */
commander
  .command('push')
  .description('Update the remote project')
  .action(push);

/**
 * Lists files that will be written to the server on `push`.
 * Ignores files:
 * - That start with a .
 * - That don't have an accepted file extension
 * - That are ignored (filename matches a glob pattern in the ignore file)
 */
commander
.command('status')
.description('Lists files that will be pushed by clasp')
.option('--json', 'Show status in JSON form')
.action(status);

/**
 * Opens the script editor in the user's browser.
 */
commander
  .command('open [scriptId]')
  .description('Open a script')
  .action(openCmd);

/**
 * List deployments of a script
 */
commander
  .command('deployments')
  .description('List deployment ids of a script')
  .action(deployments);

/**
 * Creates a version and deploys a script.
 * The response gives the version of the deployment.
 */
commander
  .command('deploy [version] [description]')
  .description('Deploy a project')
  .action(deploy);

/**
 * Undeploys a deployment of a script.
 * @example "undeploy 123"
 */
commander
  .command('undeploy <deploymentId>')
  .description('Undeploy a deployment of a project')
  .action(undeploy);

/**
 * Updates deployments of a script
 */
commander
  .command('redeploy <deploymentId> <version> <description>')
  .description(`Update a deployment`)
  .action(redeploy);

/**
 * List versions of a script
 */
commander
  .command('versions')
  .description('List versions of a script')
  .action(versions);

/**
 * Creates an immutable version of the script
 */
commander
  .command('version [description]')
  .description('Creates an immutable version of the script')
  .action(version);

/**
 * Lists your most recent 10 apps scripts
 * TODO: add --all flag
 * @example `list`
 * This would show someting like:
 * helloworld1          – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * helloworld2          – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * helloworld3          – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
commander
  .command('list')
  .description('List App Scripts projects')
  .action(list);

/**
 * Prints out 5 most recent the StackDriver logs.
 * Use --json for output in json format
 * Use --open to open logs in StackDriver
 */
commander
  .command('logs')
  .description('Shows the StackDriver logs')
  .option('--json', 'Show logs in JSON form')
  .option('--open', 'Open the StackDriver logs in browser')
  .action(logs);

/**
 * Clasp run <functionName>
 * This function runs your script in the cloud. You must supply
 * the functionName params. For now, it can
 * only run functions that do not require other authorization.
 * @param functionName function in the script that you want to run
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run
 * Note: to use this command, you must have used `clasp login --ownkey`
 */
commander
  .command('run <functionName>')
  .description('Run a function in your Apps Scripts project')
  .action(run);

/**
 * Displays the help function
 */
commander
  .command('help')
  .description('Display help')
  .action(help);

/**
 * All other commands are given a help message.
 */
commander
  .command('*', { isDefault: true })
  .description('Any other command is not supported')
  .action(defaultCmd);

// defaults to help if commands are not provided
if (!process.argv.slice(2).length) {
  commander.outputHelp();
}

// User input is provided from the process' arguments
commander.parse(process.argv);
