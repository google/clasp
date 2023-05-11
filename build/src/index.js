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
 * clasp - The Apps Script CLI
 */
import { program } from 'commander';
import loudRejection from 'loud-rejection';
import { dirname } from 'path';
import { readPackageUpSync } from 'read-pkg-up';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { ClaspError } from './clasp-error.js';
import apis from './commands/apis.js';
import clone from './commands/clone.js';
import create from './commands/create.js';
import defaultCmd from './commands/default.js';
import deploy from './commands/deploy.js';
import deployments from './commands/deployments.js';
import list from './commands/list.js';
import login from './commands/login.js';
import logout from './commands/logout.js';
import logs from './commands/logs.js';
import openCmd from './commands/open.js';
import pull from './commands/pull.js';
import push from './commands/push.js';
import run from './commands/run.js';
import setting from './commands/setting.js';
import status from './commands/status.js';
import undeploy from './commands/undeploy.js';
import version from './commands/version.js';
import versions from './commands/versions.js';
import { Conf } from './conf.js';
import { PROJECT_NAME } from './constants.js';
import { spinner, stopSpinner } from './utils.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
// instantiate the config singleton (and loads environment variables as a side effect)
const config = Conf.get();
// Ensure any unhandled exception won't go unnoticed
loudRejection();
const manifest = readPackageUpSync({ cwd: __dirname });
// CLI
/**
 * Set global CLI configurations
 */
program.storeOptionsAsProperties(false);
/**
 * Displays clasp version
 */
program.version(manifest ? manifest.packageJson.version : 'unknown', '-v, --version', 'output the current version');
program.name(PROJECT_NAME).usage('<command> [options]').description(`${PROJECT_NAME} - The Apps Script CLI`);
/**
 * Path to an auth file, or to a folder with a '.clasprc.json' file.
 */
program
    .option('-A, --auth <file>', "path to an auth file or a folder with a '.clasprc.json' file.")
    .on('option:auth', (auth) => {
    config.auth = auth;
});
/**
 * Path to an ignore file, or to a folder with a '.claspignore'.
 */
program
    .option('-I, --ignore <file>', "path to an ignore file or a folder with a '.claspignore' file.")
    .on('option:ignore', (ignore) => {
    config.ignore = ignore;
});
/**
 * Path to a project file, or to a folder with a '.clasp.json'.
 */
program
    .option('-P, --project <file>', "path to a project file or to a folder with a '.clasp.json' file.")
    .on('option:project', (path) => {
    const stats = fs.lstatSync(path);
    if (stats.isDirectory()) {
        config.projectRootDirectory = path;
    }
    else {
        config.projectConfig = path;
    }
});
/**
 * Logs the user in. Saves the client credentials to an rc file.
 * @name login
 * @param {string?} [--no-localhost] Do not run a local server, manually enter code instead.
 * @param {string?} [--creds] Relative path to credentials (from GCP).
 * @example login (uses default clasp credentials)
 * @example login --creds credentials.json (uses your credentials file).
 * @see test
 */
program
    .command('login')
    .description('Log in to script.google.com')
    .option('--no-localhost', 'Do not run a local server, manually enter code instead')
    .option('--creds <file>', 'Relative path to credentials (from GCP).')
    .option('--status', 'Print who is logged in')
    .action(login);
/**
 * Logs out the user by deleteing client credentials.
 * @name logout
 * @example logout
 */
program.command('logout').description('Log out').action(logout);
/**
 * Creates a new script project.
 * @name create
 * @param {string?} [--title] An optional project title.
 * @param {string?} [--parentId] An optional project parent Id. The Drive ID of a parent file
 *   that the created script project is bound to. This is usually the ID of a
 *   Google Doc, Google Sheet, Google Form, or Google Slides file. If not set, a
 *   standalone script project is created.
 *   https://drive.google.com/open?id=<ID>
 * @param {string?} [--rootDir] Local root directory that store your project files.
 * @example create
 * @example create "My Script"
 * @example create "My Script" "1D_Gxyv*****************************NXO7o"
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/projects/create
 */
program
    .command('create')
    .description('Create a script')
    .option('--type <type>', 'Creates a new Apps Script project attached to a new Document, Spreadsheet, Presentation, Form, or as a standalone script, web app, or API.')
    .option('--title <title>', 'The project title.')
    .option('--parentId <id>', 'A project parent Id.')
    .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
    .action(create);
/**
 * Fetches a project and saves the script id locally.
 * @param {string?} [scriptId] The script ID to clone.
 * @param {string?} [versionNumber] The version of the script to clone.
 * @param {string?} [--rootDir] Local root directory that store your project files.
 */
program
    .command('clone [scriptId] [versionNumber]')
    .description('Clone a project')
    .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
    .action(clone);
/**
 * Fetches a project from either a provided or saved script id.
 * Updates local files with Apps Script project.
 * @name pull
 * @example pull
 */
program
    .command('pull')
    .description('Fetch a remote project')
    .option('--versionNumber <version>', 'The version number of the project to retrieve.')
    .action(pull);
/**
 * Force writes all local files to the script management server.
 * @name push
 * @desc Ignores files:
 * - That start with a .
 * - That don't have an accepted file extension
 * - That are ignored (filename matches a glob pattern in the ignore file)
 * @example push
 * @example push --force
 * @example push --watch
 */
program
    .command('push')
    .description('Update the remote project')
    .option('-f, --force', 'Forcibly overwrites the remote manifest.')
    .option('-w, --watch', 'Watches for local file changes. Pushes when a non-ignored file changes.')
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
program
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
program
    .command('open [scriptId]')
    .description('Open a script')
    .option('--webapp', 'Open web application in the browser')
    .option('--creds', 'Open the URL to create credentials')
    .option('--addon', 'List parent IDs and open the URL of the first one')
    .option('--deploymentId <id>', 'Use custom deployment ID with webapp')
    .action(openCmd);
/**
 * List deployments of a script
 * @name deployments
 * @example deployments
 */
program.command('deployments').description('List deployment ids of a script').action(deployments);
/**
 * Creates a version and deploys a script.
 * The response gives the version of the deployment.
 * @name deploy
 * @example deploy (create new deployment and new version)
 * @example deploy --versionNumber 4 (create new deployment)
 * @example deploy --description "Updates sidebar logo." (deploy with description)
 * @example deploy --deploymentId 123 (create new version)
 * @example deploy -V 7 -d "Updates sidebar logo." -i 456
 */
program
    .command('deploy')
    .description('Deploy a project')
    .option('-V, --versionNumber <version>', 'The project version') // We can't use `version` in subcommand
    .option('-d, --description <description>', 'The deployment description')
    .option('-i, --deploymentId <id>', 'The deployment ID to redeploy')
    .action(deploy);
/**
 * Undeploys a deployment of a script.
 * @name undeploy
 * @param {string?} [deploymentId] The deployment ID.
 * @param {boolean?} all Setup StackDriver logs.
 * @example "undeploy" (undeploy the last deployment.)
 * @example "undeploy 123"
 * @example "undeploy --all"
 */
program
    .command('undeploy [deploymentId]')
    .description('Undeploy a deployment of a project')
    .option('-a, --all', 'Undeploy all deployments')
    .action(undeploy);
/**
 * Creates an immutable version of the script.
 * @name version
 * @param {string?} description The description of the script version.
 * @example version
 * @example version "Bump the version."
 */
program.command('version [description]').description('Creates an immutable version of the script').action(version);
/**
 * List versions of a script.
 * @name versions
 * @example versions
 */
program.command('versions').description('List versions of a script').action(versions);
/**
 * Lists your most recent 10 Apps Script projects.
 * @name list
 * @example list # helloworld1 - xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ...
 * @todo Add --all flag to list all projects.
 */
program
    .command('list')
    .description('List App Scripts projects')
    .option('--noShorten', 'Do not shorten long names', false)
    .action(list);
/**
 * Prints StackDriver logs.
 * @name logs
 * @param {boolean?} json Output logs in json format.
 * @param {boolean?} open Open StackDriver logs in a browser.
 * @param {boolean?} setup Setup StackDriver logs.
 */
program
    .command('logs')
    .description('Shows the StackDriver logs')
    .option('--json', 'Show logs in JSON form')
    .option('--open', 'Open the StackDriver logs in the browser')
    .option('--setup', 'Setup StackDriver logs')
    .option('--watch', 'Watch and print new logs')
    .option('--simplified', 'Hide timestamps with logs')
    .action(logs);
/**
 * Remotely executes an Apps Script function.
 * This function runs your script in the cloud. You must supply
 * the functionName params. For now, it can
 * only run functions that do not require other authorization.
 * @name run
 * @param {string} functionName The function in the script that you want to run.
 * @param {boolean?} nondev Run script function in non-devMode.
 * @example run 'sendEmail'
 * @see https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run
 * @requires `clasp login --creds` to be run beforehand.
 */
program
    .command('run [functionName]')
    .description('Run a function in your Apps Scripts project')
    .option('--nondev', 'Run script function in non-devMode')
    .option('-p, --params [StringArray]', 'Add parameters required for the function as a JSON String Array')
    .action(run);
/**
 * List, enable, or disable APIs for your project.
 * Currently, only list is supported.
 * @name apis
 * @example apis list
 * @example apis enable drive
 */
program
    .command('apis')
    .description(`List, enable, or disable APIs
  list
  enable <api>
  disable <api>`)
    .option('--open', 'Open the API Console in the browser')
    .action(apis);
/**
 * Update .clasp.json settings file.
 * If `newValue` is omitted, it returns the current setting value
 * If `settingKey` is omitted, it returns all keys in .clasp.json
 * @name setting
 * @param {string?} settingKey They key in .clasp.json you want to change
 * @param {string?} newValue The new value for the setting
 * @example setting
 * @example setting scriptId
 * @example setting scriptId new-id
 */
program
    .command('setting [settingKey] [newValue]')
    .alias('settings')
    .description('Update <settingKey> in .clasp.json')
    .action(setting);
/**
 * All other commands are given a help message.
 * @example random
 */
program.command('*', { isDefault: true }).description('Any other command is not supported').action(defaultCmd);
/**
 * @internal
 * Displays clasp paths
 */
program
    .command('paths')
    .description('List current config files path')
    .action(() => {
    console.log('project', config.projectConfig);
    console.log('ignore', config.ignore);
    console.log('auth', config.auth);
});
const [_bin, _sourcePath, ...args] = process.argv;
// Defaults to help if commands are not provided
if (args.length === 0) {
    program.outputHelp();
}
(async () => {
    try {
        // User input is provided from the process' arguments
        await program.parseAsync(process.argv);
        stopSpinner();
    }
    catch (error) {
        spinner.stop();
        if (error instanceof ClaspError) {
            // ClaspError handles process.exitCode
            console.error(error.message);
        }
        else if (error instanceof Error) {
            process.exitCode = 1;
            console.error(error.message);
        }
        else {
            process.exitCode = 1;
            console.error('Unknown error', error);
        }
    }
    spinner.clear();
})();
//# sourceMappingURL=index.js.map