// Copyright 2019 Google LLC
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

// This file contains tests for the 'push' command.

import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {runCommand} from '../../test/commands/utils.js';
import {useChaiExtensions} from '../../test/helpers.js';
import {
  forceInteractiveMode,
  mockOAuthRefreshRequest,
  mockScriptDownload,
  mockScriptPush,
  resetMocks,
  setupMocks,
} from '../../test/mocks.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Push command', function () {
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
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should push files if changed', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
        files: [
          {
            name: 'appsscript',
            type: 'JSON',
            source: fs.readFileSync('appsscript.json', 'utf8').toString(),
          },
        ],
      });
      mockScriptPush({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['push']);
      expect(out.stdout).to.match(/Pushed 2 files at .+/);
    });

    it('should push files from the rootDir if changed', async function () {
      mockfs({
        'dist/appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'dist/Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-dist.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
        files: [
          {
            name: 'appsscript',
            type: 'JSON',
            source: fs.readFileSync('dist/appsscript.json', 'utf8').toString(),
          },
        ],
      });
      mockScriptPush({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['push']);
      expect(out.stdout).to.match(/Pushed 2 files at .+/);
    });

    it('should handle manifest update prompt', async function () {
      mockfs({
        'appsscript.json': '{ "timeZone": "America/Los_Angeles" }',
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      forceInteractiveMode(true);
      mockScriptDownload({
        scriptId: 'mock-script-id',
        files: [
          {
            name: 'appsscript',
            type: 'JSON',
            source: '',
          },
        ],
      });
      mockScriptPush({
        scriptId: 'mock-script-id',
      });
      sinon.stub(inquirer, 'prompt').resolves({overwrite: true});
      const out = await runCommand(['push']);
      expect(out.stdout).to.match(/Pushed 2 files at .+/);
    });

    it('should skip push on manifest update reject', async function () {
      mockfs({
        'appsscript.json': '{ "timeZone": "America/Los_Angeles" }',
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      forceInteractiveMode(true);
      mockScriptDownload({
        scriptId: 'mock-script-id',
        files: [
          {
            name: 'appsscript',
            type: 'JSON',
            source: '',
          },
        ],
      });
      mockScriptPush({
        scriptId: 'mock-script-id',
      });
      sinon.stub(inquirer, 'prompt').resolves({overwrite: false});
      const out = await runCommand(['push']);
      expect(out.stdout).to.contain('Skipping push');
      expect(out.stdout).to.not.match(/Pushed 2 files at .+/);
    });

    it('should push files as json', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
        files: [
          {
            name: 'appsscript',
            type: 'JSON',
            source: fs.readFileSync('appsscript.json', 'utf8').toString(),
          },
        ],
      });
      mockScriptPush({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['push', '--json']);
      const json = JSON.parse(out.stdout);
      expect(json).to.be.an('array');
      expect(json.length).to.equal(2);
    });
  });

  describe('Without project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should reject missing project id', async function () {
      const out = await runCommand(['push']);
      expect(out.stderr).to.contain('Project settings not found.');
    });
  });
});
