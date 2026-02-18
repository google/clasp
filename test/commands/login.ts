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

// This file contains tests for the 'logout' command.
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import esmock from 'esmock';
import {after, before, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {buildScopes, mergeScopes, parseExtraScopes} from '../../src/commands/login.js';
import {useChaiExtensions} from '../helpers.js';
import {resetMocks, setupMocks} from '../mocks.js';
import type {CommandResult} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genMockRunCommand = async (): Promise<(args: String[]) => Promise<CommandResult>> => {
  const mockedLoginModule = await esmock('../../src/commands/login.js', {
    '../../src/auth/auth.js': {authorize: () => {}},
  });
  const mockedProgramModule = await esmock('../../src/commands/program.js', {
    '../../src/commands/login.js': mockedLoginModule,
  });
  const {runCommand: mockedRunCommand} = await esmock('./utils.js', {
    '../../src/commands/program.js': mockedProgramModule,
  });
  return mockedRunCommand;
};

let runCommand: (args: String[]) => Promise<CommandResult>;

describe('Login command', function () {
  before(async function () {
    setupMocks();
    // Load filesystem to enable esmock to resolve imports
    mockfs({
      src: mockfs.load(path.resolve(__dirname, '../../src')),
      test: mockfs.load(path.resolve(__dirname, '../')),
      node_modules: mockfs.load(path.resolve(__dirname, '../../node_modules')),
    });
    runCommand = await genMockRunCommand();
  });

  after(function () {
    resetMocks();
  });

  describe('Test defaults', function () {
    it('no args', async function () {
      const result: CommandResult = await runCommand(['login']);
      expect(result.exitCode).to.equal(0);
    });
  });

  describe('mergeScopes', function () {
    it('returns default scopes when project scopes are undefined', function () {
      const defaultScopes = ['scopeA', 'scopeB'];
      expect(mergeScopes(defaultScopes)).to.deep.equal(defaultScopes);
    });

    it('merges and deduplicates scopes preserving order', function () {
      const defaultScopes = ['scopeA', 'scopeB'];
      const projectScopes = ['scopeB', 'scopeC', 'scopeA', 'scopeD'];
      expect(mergeScopes(defaultScopes, projectScopes)).to.deep.equal(['scopeA', 'scopeB', 'scopeC', 'scopeD']);
    });
  });

  describe('parseExtraScopes', function () {
    it('parses and trims a comma-separated scope list', function () {
      expect(parseExtraScopes('scopeA, scopeB ,scopeC')).to.deep.equal(['scopeA', 'scopeB', 'scopeC']);
    });

    it('rejects empty scopes in the list', function () {
      expect(() => parseExtraScopes('scopeA,,scopeB')).to.throw('comma-separated list of non-empty scopes');
    });
  });

  describe('buildScopes', function () {
    const defaultScopes = ['claspA', 'claspB'];
    const manifestScopes = ['manifestA', 'manifestB'];

    it('uses default scopes by default', function () {
      expect(
        buildScopes({
          defaultScopes,
        }),
      ).to.deep.equal(defaultScopes);
    });

    it('uses only project scopes when --use-project-scopes is set', function () {
      expect(
        buildScopes({
          defaultScopes,
          manifestScopes,
          useProjectScopes: true,
        }),
      ).to.deep.equal(manifestScopes);
    });

    it('combines project and clasp scopes when --include-clasp-scopes is set', function () {
      expect(
        buildScopes({
          defaultScopes,
          manifestScopes,
          useProjectScopes: true,
          includeClaspScopes: true,
        }),
      ).to.deep.equal(['claspA', 'claspB', 'manifestA', 'manifestB']);
    });

    it('adds extra scopes on top of selected base scopes', function () {
      expect(
        buildScopes({
          defaultScopes,
          manifestScopes,
          useProjectScopes: true,
          extraScopes: ['extraA', 'manifestA'],
        }),
      ).to.deep.equal(['manifestA', 'manifestB', 'extraA']);
    });
  });

  describe('Test option redirectPort', function () {
    it('Test setting a valid integer', async function () {
      const port = '8080';
      const result: CommandResult = await runCommand(['login', '--redirect-port', port]);
      expect(result.exitCode).to.equal(0);
    });

    it('Test validation of invalid lower bound', async function () {
      const port = '-1';
      const result: CommandResult = await runCommand(['login', '--redirect-port', port]);
      expect(result.exitCode).to.equal(1);
      expect(result.stdout).to.match(/code:.*commander.invalidArgument/);
      expect(result.message).to.have.string(`'${port}' should be >= 0 and <= 65535`);
    });

    it('Test validation of invalid upper bound', async function () {
      const port = '65536';
      const result: CommandResult = await runCommand(['login', '--redirect-port', port]);
      expect(result.exitCode).to.equal(1);
      expect(result.stdout).to.match(/code:.*commander.invalidArgument/);
      expect(result.message).to.have.string(`'${port}' should be >= 0 and <= 65535`);
    });

    it('Test validation of missing parameter', async function () {
      const result: CommandResult = await runCommand(['login', '--redirect-port']);
      expect(result.exitCode).to.equal(1);
      expect(result.stdout).to.match(/code:.*commander\.optionMissingArgument/);
      expect(result.message).to.have.string('argument missing');
    });

    it('Test validation of invalid float', async function () {
      const port = '8080.5';
      const result: CommandResult = await runCommand(['login', '--redirect-port', port]);
      expect(result.exitCode).to.equal(1);
      expect(result.stdout).to.match(/code:.*commander.invalidArgument/);
      expect(result.message).to.have.string(`'${port}' is not a valid integer`);
    });

    it('Test validation of invalid string', async function () {
      const port = 'eight-thousand-eighty';
      const result: CommandResult = await runCommand(['login', '--redirect-port', port]);
      expect(result.exitCode).to.equal(1);
      expect(result.stdout).to.match(/code:.*commander.invalidArgument/);
      expect(result.message).to.have.string(`'${port}' is not a valid integer`);
    });
  });

  describe('Test option extraScopes', function () {
    it('Test valid comma-separated scopes', async function () {
      const scopes = 'scopeA,scopeB';
      const result: CommandResult = await runCommand(['login', '--extra-scopes', scopes]);
      expect(result.exitCode).to.equal(0);
    });

    it('Test validation of empty scope in list', async function () {
      const scopes = 'scopeA,,scopeB';
      const result: CommandResult = await runCommand(['login', '--extra-scopes', scopes]);
      expect(result.exitCode).to.equal(1);
      expect(result.stdout).to.match(/code:.*commander.invalidArgument/);
      expect(result.message).to.have.string('comma-separated list of non-empty scopes');
    });
  });

  describe('Test option includeClaspScopes', function () {
    it('requires --use-project-scopes', async function () {
      const result: CommandResult = await runCommand(['login', '--include-clasp-scopes']);
      expect(result.exitCode).to.equal(1);
      expect(result.stdout).to.match(/code:.*commander.error/);
      expect(result.message).to.have.string('--include-clasp-scopes can only be used with --use-project-scopes');
    });
  });
});
