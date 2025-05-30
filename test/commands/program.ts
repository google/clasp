
import {describe, it} from 'mocha';
import {expect} from 'chai';

import { makeProgram } from '../../src/commands/program.js';

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
