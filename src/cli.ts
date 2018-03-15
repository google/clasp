#!/usr/bin/env node

const commander = require('commander');

import {
  PROJECT_NAME, ERROR, LoginOptions,
  login, logout, create, clone, pull, push, openScriptProject,
  listDeployments, deploy, undeploy, redeploy, listVersions, createVersion
} from "./index";

/**
 * Set global CLI configurations
 */
commander
  .usage(`${PROJECT_NAME} <command> [options]`)
  .description(`${PROJECT_NAME} - The Apps Script CLI`);

commander
  .command('login')
  .description('Log in to script.google.com')
  .option('--no-localhost', 'Do not run a local server, manually enter code instead')
  .action((cmd: LoginOptions) => login(cmd.localhost));

commander
  .command('logout')
  .description('Log out')
  .action(logout);

commander
  .command('create [scriptTitle] [scriptParentId]')
  .description('Create a script')
  .action(create);

commander
  .command('clone <scriptId> [versionNumber]')
  .description('Clone a project')
  .action(clone);

commander
  .command('pull')
  .description('Fetch a remote project')
  .action(pull);


commander
  .command('push')
  .description('Update the remote project')
  .action(push);

commander
  .command('open')
  .description('Open a script')
  .action(openScriptProject);
commander
  .command('deployments')
  .description('List deployment ids of a script')
  .action(listDeployments);

commander
  .command('deploy [version] [description]')
  .description('Deploy a project')
  .action(deploy);

commander
  .command('undeploy <deploymentId>')
  .description('Undeploy a deployment of a project')
  .action(undeploy);

commander
  .command('redeploy <deploymentId> <version> <description>')
  .description(`Update a deployment`)
  .action(redeploy);

  commander
    .command('versions')
    .description('List versions of a script')
    .action(listVersions);

  commander
    .command('version [description]')
    .description('Creates an immutable version of the script')
    .action(createVersion);

/**
 * All other commands are given a help message.
 */
commander
  .command('', { isDefault: true })
  .action((command: string) => {
    console.error(ERROR.COMMAND_DNE(command));
  });

// defaults to help if commands are not provided
if (!process.argv.slice(2).length) {
  commander.outputHelp();
}

// User input is provided from the process' arguments
commander.parse(process.argv);
