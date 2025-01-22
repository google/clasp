import {Command, Option} from 'commander';
import {PROJECT_NAME} from '../constants.js';
import {ERROR} from '../messages.js';
import {disableApiCommand, enableApiCommand, listApisCommand, openApisCommand} from './apis.js';
import {cloneProjectCommand} from './clone.js';
import {createCommand} from './create.js';
import {deployCommand} from './deploy.js';
import {listDeploymentsCommand} from './deployments.js';
import {listProjectsCommand} from './list.js';
import {loginCommand} from './login.js';
import {logoutCommand} from './logout.js';
import {printLogsCommand} from './logs.js';
import {openProjectCommand} from './open.js';
import {pullFilesCommand} from './pull.js';
import {pushFilesCommand} from './push.js';
import {runFunctionCommand} from './run.js';
import {updateSettingCommand} from './setting.js';
import {showFileStatusCommand} from './status.js';
import {undeployCommand} from './undeploy.js';
import {createVersionCommand} from './version.js';
import {listVersionsCommand} from './versions.js';

import {dirname} from 'path';
import {fileURLToPath} from 'url';
import {readPackageUpSync} from 'read-pkg-up';
import {createContext} from '../context.js';

export function makeProgram() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const manifest = readPackageUpSync({cwd: __dirname});
  const version = manifest ? manifest.packageJson.version : 'unknown';

  const program = new Command();

  program.storeOptionsAsProperties(false);

  /**
   * Displays clasp version
   */
  program.version(version, '-v, --version', 'output the current version');
  program.name(PROJECT_NAME).usage('<command> [options]').description(`${PROJECT_NAME} - The Apps Script CLI`);

  program.hook('preAction', async (_, cmd) => {
    // TODO - Set up auth/env/etc

    const opts = cmd.optsWithGlobals();
    const context = await createContext({
      env: opts.env,
      projectPath: opts.project,
      ignoreFilePath: opts.ignore,
      authFilePath: opts.auth,
      userKey: opts.user,
      useApplicationDefaultCredentials: opts.adc,
    });
    cmd.setOptionValue('context', context);
  });

  /**
   * Path to an auth file, or to a folder with a '.clasprc.json' file.
   */
  program.addOption(
    new Option('-A, --auth <file>', "path to an auth file or a folder with a '.clasprc.json' file.").env(
      'clasp_config_auth',
    ),
  );

  program.option('-u,--user <name>', 'Store named credentials. If unspecified, the "default" user is used.', 'default');
  program.option('-e, --env <name>', 'Load config from .clasp.<env>.json');
  program.option('--adc', 'Use the application default credentials from the environemnt.');

  /**
   * Path to an ignore file, or to a folder with a '.claspignore'.
   */
  program.addOption(
    new Option('-I, --ignore <file>', "path to an ignore file or a folder with a '.claspignore' file.").env(
      'clasp_config_ignore',
    ),
  );

  /**
   * Path to a project file, or to a folder with a '.clasp.json'.
   */

  program.addOption(
    new Option('-P, --project <file>', "path to a project file or to a folder with a '.clasp.json' file.").env(
      'clasp_config_project',
    ),
  );

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
    .option('--creds <file>', 'Relative path to OAuth client secret file (from GCP).')
    .option(
      '--use-project-scopes',
      'Use the scopes from the current project manifest. Used only when authorizing access for the run command.',
    )
    .option('--status', 'Print who is logged in')
    .option('--redirect-port <port>', 'Specify a custom port for the redirect URL.')
    .action(loginCommand);

  /**
   * Logs out the user by deleting client credentials.
   * @name logout
   * @example logout
   */
  program.command('logout').description('Log out').action(logoutCommand);

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
    .option(
      '--type <type>',
      'Creates a new Apps Script project attached to a new Document, Spreadsheet, Presentation, Form, or as a standalone script, web app, or API.',
      'standalone',
    )
    .option('--title <title>', 'The project title.')
    .option('--parentId <id>', 'A project parent Id.')
    .option('--rootDir <rootDir>', 'Local root directory in which clasp will store your project files.')
    .action(createCommand);

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
    .action(cloneProjectCommand);

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
    .action(pullFilesCommand);

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
    .action(pushFilesCommand);

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
    .action(showFileStatusCommand);

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
    .action(openProjectCommand);

  /**
   * List deployments of a script
   * @name deployments
   * @example deployments
   */
  program.command('deployments').description('List deployment ids of a script').action(listDeploymentsCommand);

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
    .action(deployCommand);

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
    .action(undeployCommand);

  /**
   * Creates an immutable version of the script.
   * @name version
   * @param {string?} description The description of the script version.
   * @example version
   * @example version "Bump the version."
   */
  program
    .command('version [description]')
    .description('Creates an immutable version of the script')
    .action(createVersionCommand);

  /**
   * List versions of a script.
   * @name versions
   * @example versions
   */
  program.command('versions').description('List versions of a script').action(listVersionsCommand);

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
    .action(listProjectsCommand);

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
    .action(printLogsCommand);

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
    .action(runFunctionCommand);

  /**
   * List, enable, or disable APIs for your project.
   * Currently, only list is supported.
   * @name apis
   * @example apis list
   * @example apis enable drive
   */
  const apisCmd = program.command('apis').description('List, enable, or disable APIs');
  apisCmd
    .command('list')
    .description('List enabled APIs for the current project')
    .option('--test', 'test')
    .action(listApisCommand);
  apisCmd.command('open').description('Open the API console for the current project.').action(openApisCommand);
  apisCmd
    .command('enable')
    .description('Enable a service for the current project.')
    .argument('<api>', 'Service to enable')
    .action(enableApiCommand);
  apisCmd
    .command('disable')
    .description('Enable a service for the current project.')
    .argument('<api>', 'Service to disable')
    .action(disableApiCommand);

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
    .action(updateSettingCommand);

  program.on('command:*', op => {
    console.error(ERROR.COMMAND_DNE(op[0]));
    process.exitCode = 1;
  });

  return program;
}
