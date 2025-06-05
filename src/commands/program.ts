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

import {Command, CommanderError, Option} from 'commander';
import {PROJECT_NAME} from '../constants.js';

import {command as cloneCommand} from './clone-script.js';
import {command as createDeploymentCommand} from './create-deployment.js';
import {command as createCommand} from './create-script.js';
import {command as createVersionCommand} from './create-version.js';
import {command as deleteDeploymentCOmand} from './delete-deployment.js';
import {command as disableApiCommand} from './disable-api.js';
import {command as enableApiCommand} from './enable-api.js';
import {command as listApisCommand} from './list-apis.js';
import {command as listDeploymentsCommand} from './list-deployments.js';
import {command as listCommand} from './list-scripts.js';
import {command as listVersionsCommand} from './list-versions.js';
import {command as loginCommand} from './login.js';
import {command as logoutCommand} from './logout.js';
import {command as openApisConsoleCommand} from './open-apis.js';
import {command as openContainerCommand} from './open-container.js';
import {command as openAuthCommand} from './open-credentials.js';
import {command as openLogsCommand} from './open-logs.js';
import {command as openScriptCommand} from './open-script.js';
import {command as openWebappCommand} from './open-webapp.js';
import {command as pullCommand} from './pull.js';
import {command as pushCommand} from './push.js';
import {command as runCommand} from './run-function.js';
import {command as setupLogsCommand} from './setup-logs.js';
import {command as authStatusCommand} from './show-authorized-user.js';
import {command as filesStatusCommand} from './show-file-status.js';
import {command as mcpCommand} from './start-mcp.js';
import {command as tailLogsCommand} from './tail-logs.js';
import {command as updateDeploymentCommand} from './update-deployment.js';

import {dirname} from 'path';
import {fileURLToPath} from 'url';
import {readPackageUpSync} from 'read-package-up';
import {initAuth} from '../auth/auth.js';
import {initClaspInstance} from '../core/clasp.js';
import {intl} from '../intl.js';

export function getVersion() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const manifest = readPackageUpSync({cwd: __dirname});
  const version = manifest ? manifest.packageJson.version : 'unknown';
  return version;
}

export function makeProgram(exitOveride?: (err: CommanderError) => void) {
  const version = getVersion();

  const program = new Command();

  program.exitOverride(exitOveride);

  program.storeOptionsAsProperties(false);

  /**
   * Displays clasp version
   */
  program.version(version, '-v, --version', 'output the current version');
  program.name(PROJECT_NAME).usage('<command> [options]').description(`${PROJECT_NAME} - The Apps Script CLI`);

  program.hook('preAction', async (_, cmd) => {
    const opts = cmd.optsWithGlobals();

    const auth = await initAuth({
      authFilePath: opts.auth,
      userKey: opts.user,
      useApplicationDefaultCredentials: opts.adc,
    });
    const clasp = await initClaspInstance({
      credentials: auth.credentials,
      configFile: opts.project,
      ignoreFile: opts.ignore,
    });

    cmd.setOptionValue('clasp', clasp);
    cmd.setOptionValue('auth', auth);
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
  program.option('--adc', 'Use the application default credentials from the environemnt.');
  program.addOption(
    new Option('-I, --ignore <file>', "path to an ignore file or a folder with a '.claspignore' file.").env(
      'clasp_config_ignore',
    ),
  );
  program.addOption(
    new Option('-P, --project <file>', "path to a project file or to a folder with a '.clasp.json' file.").env(
      'clasp_config_project',
    ),
  );

  const commandsToAdd = [
    loginCommand,
    logoutCommand,
    openAuthCommand,
    cloneCommand,
    createCommand,
    pushCommand,
    pullCommand,
    createDeploymentCommand,
    deleteDeploymentCOmand,
    listDeploymentsCommand,
    updateDeploymentCommand,
    disableApiCommand,
    enableApiCommand,
    listApisCommand,
    openApisConsoleCommand,
    authStatusCommand,
    filesStatusCommand,
    openLogsCommand,
    setupLogsCommand,
    tailLogsCommand,
    openScriptCommand,
    openContainerCommand,
    openWebappCommand,
    runCommand,
    listCommand,
    createVersionCommand,
    listVersionsCommand,
    mcpCommand,
  ];

  for (const cmd of commandsToAdd) {
    program.addCommand(cmd);
    cmd.copyInheritedSettings(program);
  }

  program.on('command:*', async function (this: Command, op) {
    const msg = intl.formatMessage(
      {
        defaultMessage: 'Unknown command "clasp {command}"',
      },
      {
        command: op[0],
      },
    );
    this.error(msg as string);
  });

  program.error;

  return program;
}
