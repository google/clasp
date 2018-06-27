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

import { login } from './src/auth';
import {
  apis,
  clone,
  create,
  defaultCmd,
  deploy,
  deployments,
  help,
  list,
  logout,
  logs,
  openCmd,
  pull,
  push,
  redeploy,
  run,
  status,
  undeploy,
  version,
  versions,
} from './src/commands';
import { PROJECT_NAME } from './src/utils';

const commander = require('commander');

// CLI

/**
 * Set global CLI configurations
 */
commander
  .usage(`${PROJECT_NAME} <command> [options]`)
  .description(`${PROJECT_NAME} - The Apps Script CLI`);

/**
 * Logs the user in. Saves the client credentials to an rc file.
 * @name login
 * @param {string?} [--no-localhost] Do not run a local server, manually enter code instead.
 * @param {string?} [--creds] Relative path to credentials (from GCP).
 * @example login (uses default clasp credentials)
 * @example login --creds credentials.json (uses your credentials file).
 * @see test
 */
commander
  .command('login')
  .description('Log in to script.google.com')
  .option('--no-localhost', 'Do not run a local server, manually enter code instead')
  .option('--creds <file>', 'Relative path to credentials (from GCP).')
  .action(login);

/**
 * Logs out the user by deleteing client credentials.
 * @name logout
 * @example logout
 */
commander
  .command('logout')
  .description('Log out')
  .action(logout);

/**
 * Creates a new script project.
 * @name create
 * @param {string?} [scriptTitle] An optional project title.
 * @param {string?} [scriptParentId] An optional project parent Id. The Drive ID of a parent file
 *   that the created script project is bound to. This is usually the ID of a
 *   Google Doc, Google Sheet, Google Form, or Google Slides file. If not set, a
 *   standalone script project is created.
 * @example create
 * @example create "My Script"
 * @example create "My Script" "1D_Gxyv*****************************NXO7o"
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/projects/create
 */
commander
  .command('create [scriptTitle] [scriptParentId]')
  .description('Create a script')
  .action(create);

/**
 * Fetches a project and saves the script id locally.
 * @param {string?} [scriptId] The script ID to clone.
 * @param {string?} [versionNumber] The version of the script to clone.
 */
commander
  .command('clone [scriptId] [versionNumber]')
  .description('Clone a project')
  .action(clone);

/**
 * Fetches a project from either a provided or saved script id.
 * Updates local files with Apps Script project.
 * @name pull
 * @example pull
 */
commander
  .command('pull')
  .description('Fetch a remote project')
  .action(pull);

/**
 * Force writes all local files to the script management server.
 * @name push
 * @desc Ignores files:
 * - That start with a .
 * - That don't have an accepted file extension
 * - That are ignored (filename matches a glob pattern in the ignore file)
 * @example push
 * @example push --watch
 */
commander
  .command('push')
  .description('Update the remote project')
  .option('--watch', 'Watches for local file changes. Pushes when a non-ignored file changs.')
  .action(push);

/**
 * Lists files that will be written to the server on `push`.
 * @name status
 * @desc Ignores files:
 * - That start with a .
 * - That don't have an accepted file extension
 * - That are ignored (filename matches a glob pattern in the ignore file)
 * @example status
 */
commander
.command('status')
.description('Lists files that will be pushed by clasp')
.option('--json', 'Show status in JSON form')
.action(status);

/**
 * Opens the `clasp` project on script.google.com. Provide a `scriptId` to open a different script.
 * @name open
 * @param {string?} [scriptId] The optional script project to open.
 * @example open
 * @example open [scriptId]
 */
commander
  .command('open [scriptId]')
  .description('Open a script')
  .action(openCmd);

/**
 * List deployments of a script
 * @name deployments
 * @example deployments
 */
commander
  .command('deployments')
  .description('List deployment ids of a script')
  .action(deployments);

/**
 * Creates a version and deploys a script.
 * The response gives the version of the deployment.
 * @name deploy
 * @param {number} [version] The version number.
 * @param {string} [description] The deployment description.
 * @example deploy
 * @example deploy 4
 * @example deploy 7 "Updates sidebar logo."
 */
commander
  .command('deploy [version] [description]')
  .description('Deploy a project')
  .action(deploy);

/**
 * Undeploys a deployment of a script.
 * @name undeploy
 * @param {string} deploymentId The deployment ID.
 * @example "undeploy 123"
 */
commander
  .command('undeploy <deploymentId>')
  .description('Undeploy a deployment of a project')
  .action(undeploy);

/**
 * Updates deployments of a script.
 * @name redeploy
 * @param {number} deploymentId The deployment ID.
 * @param {number} version The target deployment version.
 * @param {string} description The reason why the script was redeployed.
 * @example redeploy 123 3 "Why I updated the deployment"
 */
commander
  .command('redeploy <deploymentId> <version> <description>')
  .description(`Update a deployment`)
  .action(redeploy);

/**
 * List versions of a script.
 * @name versions
 * @example versions
 */
commander
  .command('versions')
  .description('List versions of a script')
  .action(versions);

/**
 * Creates an immutable version of the script.
 * @name version
 * @param {string?} description The description of the script version.
 * @example version
 * @example version "Bump the version."
 */
commander
  .command('version [description]')
  .description('Creates an immutable version of the script')
  .action(version);

/**
 * Lists your most recent 10 Apps Script projects.
 * @name list
 * @example list # helloworld1 – xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ...
 * @todo Add --all flag to list all projects.
 */
commander
  .command('list')
  .description('List App Scripts projects')
  .action(list);

/**
 * Prints out 5 most recent the StackDriver logs.
 * @name logs
 * @param {boolean?} json Output logs in json format.
 * @param {boolean?} open Open StackDriver logs in a browser.
 */
commander
  .command('logs')
  .description('Shows the StackDriver logs')
  .option('--json', 'Show logs in JSON form')
  .option('--open', 'Open the StackDriver logs in browser')
  .action(logs);

/**
 * Remotely executes an Apps Script function.
 * This function runs your script in the cloud. You must supply
 * the functionName params. For now, it can
 * only run functions that do not require other authorization.
 * @name run
 * @param {string} functionName The function in the script that you want to run.
 * @example run 'sendEmail'
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run
 * @requires `clasp login --ownkey` to be run beforehand.
 */
commander
  .command('run <functionName>')
  .description('Run a function in your Apps Scripts project')
  .action(run);

/**
 * List, enable, or disable APIs for your project.
 * Currently, only list is supported.
 * @name apis
 * @example apis list
 * @example apis enable "drive.googleapis.com"
 */
commander
  .command('apis')
  .description('List, enable, or disable apis')
  .action(apis);

/**
 * Displays the help function.
 * @name help
 * @example help
 */
commander
  .command('help')
  .description('Display help')
  .action(help);

/**
 * Displays clasp version
 */
commander
.version(require('./package.json').version, '-v, --version');

/**
 * All other commands are given a help message.
 * @example random
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
