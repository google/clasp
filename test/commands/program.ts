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
 * @fileoverview Tests for the main `clasp` CLI program setup.
 * These tests ensure that all command modules defined in `src/commands/`
 * are correctly registered with the main `commander` program instance.
 * This helps catch issues where a new command is created but not added
 * to the main program.
 */

import {expect} from 'chai';
import {describe, it} from 'mocha';

import {makeProgram} from '../../src/commands/program.js';

// Test suite to ensure all defined commands are correctly registered with the main CLI program.
describe('Consistency between imported and registered commands', () => {
  // This list should be manually kept in sync with the actual commands available in clasp.
  // It serves as an explicit checklist for command registration.
  const expectedCommands = [
    'clone-script', // Alias: clone
    'create-deployment', // Alias: deploy
    'create-script', // Alias: create
    'create-version', // Alias: version
    'delete-deployment', // Alias: undeploy
    'disable-api',
    'enable-api',
    'list-apis', // Alias: apis
    'list-deployments', // Alias: deployments
    'list-scripts', // Alias: list
    'list-versions', // Alias: versions
    'login',
    'logout',
    'open-api-console', // No alias, specific name
    'open-container',
    'open-credentials-setup', // No alias
    'open-logs',
    'open-script',
    'open-web-app',
    'pull',
    'push',
    'run-function', // Alias: run
    'setup-logs',
    'show-authorized-user', // No alias
    'show-file-status', // Alias: status
    'start-mcp-server', // Alias: mcp
    'tail-logs', // Alias: logs
    'update-deployment', // Alias: redeploy
  ];

  // Test to ensure that every command in the `expectedCommands` list is found
  // among the commands registered in the main program.
  it('should register all expected commands', () => {
    const program = makeProgram(); // Create an instance of the main commander program.
    const registeredCommands = program.commands.map(cmd => cmd.name()); // Get names of all registered commands.

    for (const expectedCommandName of expectedCommands) {
      expect(registeredCommands).to.contain(expectedCommandName, `Command '${expectedCommandName}' is expected but not registered.`);
    }
  });

  // Test to ensure that the number of registered commands matches the number of expected commands.
  // This helps catch cases where extra, unexpected commands might have been registered.
  it('should have the exact number of registered commands as expected', () => {
    const program = makeProgram();
    expect(program.commands.length).to.equal(expectedCommands.length, 'The number of registered commands does not match the expected count.');
  });
});
