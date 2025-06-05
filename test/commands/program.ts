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

import {expect} from 'chai';
import {describe, it} from 'mocha';

import {makeProgram} from '../../src/commands/program.js';

describe('Consistency between imported and registered commands', () => {
  const expectedCommands = [
    'clone-script',
    'create-deployment',
    'create-script',
    'create-version',
    'delete-deployment',
    'disable-api',
    'enable-api',
    'list-apis',
    'list-deployments',
    'list-scripts',
    'list-versions',
    'login',
    'logout',
    'open-api-console',
    'open-container',
    'open-credentials-setup',
    'open-logs',
    'open-script',
    'open-web-app',
    'pull',
    'push',
    'run-function',
    'setup-logs',
    'show-authorized-user',
    'show-file-status',
    'start-mcp-server',
    'tail-logs',
    'update-deployment',
  ];

  it('should register all imported commands', () => {
    const program = makeProgram();

    const registeredCommands = program.commands.map(cmd => cmd.name());
    for (const cmdName of expectedCommands) {
      expect(registeredCommands).to.contain(cmdName);
    }
  });

  it('should have the same number of registered commands as imports', () => {
    const program = makeProgram();
    expect(program.commands).to.length(expectedCommands.length);
  });
});
