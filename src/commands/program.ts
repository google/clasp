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

/**
 * @fileoverview This file is the main entry point for the `clasp` CLI.
 * It sets up the `commander` program, registers all available subcommands,
 * defines global options, and initializes shared resources like authentication
 * and the `Clasp` instance before any subcommand action is executed.
 */

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

/**
 * Retrieves the version of the clasp package from its package.json.
 * @returns The version string (e.g., "1.2.3") or "unknown" if not found.
 */
export function getVersion(): string {
  // Determine the directory of the current module.
  const currentModuleDir = dirname(fileURLToPath(import.meta.url));
  // Find the closest package.json upwards from the current module directory.
  const manifest = readPackageUpSync({cwd: currentModuleDir});
  const version = manifest ? manifest.packageJson.version : 'unknown';
  return version;
}

/**
 * Creates and configures the main Commander program for the clasp CLI.
 * @param exitOverride Optional function to override the default exit behavior of Commander, useful for testing.
 * @returns The configured Commander program instance.
 */
export function makeProgram(exitOverride?: (err: CommanderError) => void): Command {
  const version = getVersion();
  const program = new Command();

  // Configure program behavior.
  if (exitOverride) {
    program.exitOverride(exitOverride);
  }
  program.storeOptionsAsProperties(false); // Recommended by Commander for new projects.

  // Define program metadata.
  program
    .version(version, '-v, --version', 'Output the current version of clasp.')
    .name(PROJECT_NAME)
    .usage('<command> [options]')
    .description(`${PROJECT_NAME} - The Apps Script CLI. Manage your Apps Script projects from the command line.`);

  // Global hook executed before any command action.
  // This initializes shared resources like AuthInfo and Clasp instances.
  program.hook('preAction', async (_, cmd) => {
    const globalOptions = cmd.optsWithGlobals();

    // Initialize authentication based on global options.
    const auth = await initAuth({
      authFilePath: globalOptions.auth,
      userKey: globalOptions.user,
      useApplicationDefaultCredentials: globalOptions.adc,
    });

    // Initialize the Clasp instance for core operations.
    const clasp = await initClaspInstance({
      credentials: auth.credentials,
      configFile: globalOptions.project,
      ignoreFile: globalOptions.ignore,
    });

    // Make auth and clasp instances available to the command being executed.
    cmd.setOptionValue('clasp', clasp);
    cmd.setOptionValue('auth', auth);
  });

  // Define global options applicable to all commands.
  program.addOption(
    new Option('-A, --auth <file>', "Path to a custom auth file or a directory containing a '.clasprc.json' file. Overrides default.")
      .env('CLASP_CONFIG_AUTH'), // Allow setting via environment variable.
  );
  program.option('-u, --user <name>', "Specify a named user credential profile. Defaults to 'default'.", 'default');
  program.option('--adc', 'Use Application Default Credentials from the environment for authentication.');
  program.addOption(
    new Option('-I, --ignore <file>', "Path to a custom ignore file or a directory containing a '.claspignore' file. Overrides default.")
      .env('CLASP_CONFIG_IGNORE'),
  );
  program.addOption(
    new Option('-P, --project <file>', "Path to a custom project file or a directory containing a '.clasp.json' file. Overrides default.")
      .env('CLASP_CONFIG_PROJECT'),
  );

  // List of all command modules to be registered with the program.
  const commandsToRegister = [
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
    mcpCommand, // Model Context Protocol server command
  ];

  // Register each command with the main program.
  for (const commandModule of commandsToRegister) {
    program.addCommand(commandModule);
    // Ensure subcommands inherit global options.
    commandModule.copyInheritedSettings(program);
  }

  // Handle unknown commands.
  program.on('command:*', async function (this: Command, operands) {
    const unknownCommand = operands[0];
    const errorMsg = intl.formatMessage(
      {
        defaultMessage: 'Unknown command: "clasp {command}". See "clasp --help" for a list of available commands.',
      },
      {
        command: unknownCommand,
      },
    );
    // Commander's error display is preferred, so use its built-in error mechanism.
    // This will also respect program.exitOverride if set.
    this.error(errorMsg, {exitCode: 1}); // Specify exit code for clarity.
  });

  // Note: `program.error` is a method, not something to be assigned or called directly here.
  // Custom error handling can be done via `program.exitOverride` or by letting Commander handle it.

  return program;
}
