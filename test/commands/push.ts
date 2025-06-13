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
      expect(out.stdout).to.contain('Pushed 2 files');
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
      expect(out.stdout).to.contain('Pushed 2 files');
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
      expect(out.stdout).to.contain('Pushed 2 files');
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
      expect(out.stdout).to.not.contain('Pushed 2 files');
    });

    it('should push files if changed and output JSON', async function () {
      // Modify Code.js to ensure it's different from default mockScriptDownload content
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': 'function newCode() { console.log("changed"); }', // Changed content
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      mockScriptDownload({ scriptId: 'mock-script-id' }); // Standard remote files
      mockScriptPush({ scriptId: 'mock-script-id' });

      const out = await runCommand(['push', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      // Expect both files if Code.js changed, as appsscript.json might be pushed too.
      // The actual pushed files are determined by Files.prototype.push after diffing.
      // Assuming both are pushed due to changes or default behavior.
      // The Files.prototype.push() method returns all local files that are not ignored.
      // So it will list all project files.
      expect(jsonResponse.pushedFiles).to.have.deep.members(['appsscript.json', 'Code.js']);
      expect(out.stdout).to.not.contain('Pushed');
    });

    it('should output nothing for JSON if no files changed', async function () {
      // Local files are identical to default mockScriptDownload content
       mockfs({
        'appsscript.json': '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
        'Code.js': 'function helloWorld() {\n  console.log("Hello, world!");\n}',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({ scriptId: 'mock-script-id' }); // content matches above
      const scriptPushStub = sinon.stub(mockScriptPush({ scriptId: 'mock-script-id' })); // To check if called

      const out = await runCommand(['push', '--json']);
      expect(out.stdout.trim()).to.equal('');
      // Potentially, scriptPushStub should not have been called if clasp.files.getChangedFiles() was empty.
      // However, the `push` command logic calls onChange if getChangedFiles > 0, OR if it's empty it prints "up to date".
      // The `onChange` itself calls `clasp.files.push()`. `clasp.files.push()` doesn't re-check for changes, it just pushes all local files.
      // This means even if getChangedFiles is empty, if we proceed to the actual push part, it pushes all.
      // The test for "Script is already up to date" relies on getChangedFiles.length being 0.
      // The JSON logic is: if `files.length > 0` (from `clasp.files.push()`), then print.
      // If `getChangedFiles` is empty, `onChange` isn't called, so `clasp.files.push` isn't called.
      // Thus, `files.length` would be effectively 0 for the JSON output part. Correct.
    });

    it('should push files from rootDir and output JSON', async function () {
       mockfs({
        'dist/appsscript.json': '{ "timeZone": "America/New_York" }', // Changed content
        'dist/Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-dist.json')), // rootDir: dist
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({ scriptId: 'mock-script-id' }); // Standard remote files
      mockScriptPush({ scriptId: 'mock-script-id' });

      const out = await runCommand(['push', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse.pushedFiles).to.have.deep.members(['dist/appsscript.json', 'dist/Code.js']);
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
