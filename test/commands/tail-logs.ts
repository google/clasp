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

// This file contains tests for the 'tail-logs' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {runCommand} from '../../test/commands/utils.js';
import {mockListLogEntries, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../../test/mocks.js';
import {forceInteractiveMode} from '../../test/mocks.js';
import {useChaiExtensions} from '../helpers.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Tail logs command', function () {
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  describe('With project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should print logs', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['tail-logs']);
      expect(out.stdout).to.contain('INFO');
      expect(out.stdout).to.contain('myFunction');
      expect(out.stdout).to.contain('test log');
    });

    it('should print logs in json, with each entry as a separate JSON string', async function () {
      const mockedEntries = [
        {
          timestamp: '2023-01-01T00:00:00Z',
          logName: `projects/mock-gcp-project/logs/stdout`,
          severity: 'INFO',
          insertId: 'id1',
          resource: {
            type: 'app_script_function',
            labels: {project_id: 'mock-gcp-project', function_name: 'func1'},
          },
          textPayload: 'Log entry 1',
        },
        {
          timestamp: '2023-01-01T00:00:01Z',
          logName: `projects/mock-gcp-project/logs/stderr`,
          severity: 'ERROR',
          insertId: 'id2',
          resource: {
            type: 'app_script_function',
            labels: {project_id: 'mock-gcp-project', function_name: 'func2'},
          },
          jsonPayload: {message: 'Log entry 2', customKey: 'customValue'},
        },
      ];
      mockListLogEntries({
        projectId: 'mock-gcp-project',
        entries: mockedEntries,
      });
      const out = await runCommand(['tail-logs', '--json']);
      const logLines = out.stdout.trim().split('\n');
      expect(logLines.length).to.equal(mockedEntries.length);

      for (let i = 0; i < logLines.length; i++) {
        const parsedLog = JSON.parse(logLines[i]);
        // The command reverses the order of entries before printing
        expect(parsedLog).to.deep.equal(mockedEntries[mockedEntries.length - 1 - i]);
      }
    });

    it('should print logs without timestamps', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['tail-logs', '--simplified']);
      expect(out.stdout).to.contain('INFO');
      expect(out.stdout).to.contain('myFunction');
      expect(out.stdout).to.contain('test log');
      expect(out.stdout).to.not.contain('GMT');
    });

    it('should prompt for project id', async function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      forceInteractiveMode(true);
      sinon.stub(inquirer, 'prompt').resolves({projectId: 'mock-gcp-project'});
      const out = await runCommand(['tail-logs']);
      expect(out.stdout).to.contain('INFO');
    });

    it('should use alias', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['logs']);
      expect(out.stdout).to.contain('INFO');
    });
  });
  describe('Without project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should reject missing project id', async function () {
      forceInteractiveMode(false);
      const out = await runCommand(['tail-logs']);
      expect(out.stderr).to.contain('not set');
    });
  });
});
