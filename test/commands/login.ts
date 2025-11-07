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

  describe('Test option redirectPort', function () {
    it('Test setting a valid integer', async function () {
      const port = '8080';
      const result: CommandResult = await runCommand(['login', '--redirect-port', port]);
      expect(result.exitCode).to.equal(0);
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
      expect(result.stdout).to.match(/code:.*commander\.error/);
      expect(result.message).to.have.string(`Port ${port} is not a valid integer`);
    });

    it('Test validation of invalid string', async function () {
      const port = 'eight-thousand-eighty';
      const result: CommandResult = await runCommand(['login', '--redirect-port', port]);
      expect(result.exitCode).to.equal(1);
      expect(result.stdout).to.match(/code:.*commander\.error/);
      expect(result.message).to.have.string(`Port ${port} is not a valid integer`);
    });
  });
});
