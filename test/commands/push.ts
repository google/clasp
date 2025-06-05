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
 * @fileoverview Integration tests for the `clasp push` command.
 * These tests cover various scenarios for pushing local file changes to an Apps Script project, including:
 * - Pushing files when local changes are detected compared to the remote project.
 * - Pushing files from a specified root directory.
 * - Handling manifest file (appsscript.json) updates, with and without the --force flag.
 * - Interactive prompts for manifest updates and skipping pushes if declined.
 * - Behavior when no local project (.clasp.json) is configured.
 */

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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp push' command.
describe('Push command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for pushing files when local project files and .clasp.json exist, and the user is authenticated.
  describe('With local project files and .clasp.json, authenticated', function () {
    beforeEach(function () {
      // Default mock filesystem: a basic project with appsscript.json, Code.js, and .clasp.json.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test pushing files when local 'Code.js' has changed compared to the (mocked) remote version.
    it('should push files if changed', async function () {
      // Mock script download: remote 'appsscript.json' is the same, but 'Code.js' will be different
      // as `mockScriptDownload` by default provides a different 'Code.js' source than the local fixture.
      // This setup ensures that `getChangedFiles` detects a change in 'Code.js'.
      mockScriptDownload({
        scriptId: 'mock-script-id',
        files: [
          {
            name: 'appsscript', // Remote name for appsscript.json
            type: 'JSON',
            source: fs.readFileSync('appsscript.json', 'utf8').toString(), // Same as local
          },
          // 'Code.js' is implicitly different due to mockScriptDownload's default.
        ],
      });
      // Mock the API call to push files.
      mockScriptPush({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['push']);
      // Expect that 'Code.js' and potentially 'appsscript.json' (if considered changed by logic) are pushed.
      // The mockPush logs the number of files it "receives".
      expect(out.stdout).to.contain('Pushed 2 files'); // Expecting appsscript.json and Code.js
    });

    // Test pushing files when `rootDir` is specified in .clasp.json.
    it('should push files from the rootDir if changed', async function () {
      // Filesystem setup with source files in 'dist/' and .clasp.json pointing to 'dist/' as rootDir.
      mockfs({
        'dist/appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'dist/Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-dist.json')), // Sets "rootDir": "dist"
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      // Simulate remote 'appsscript.json' being the same as local 'dist/appsscript.json'.
      // 'Code.js' will be different by default from mockScriptDownload.
      mockScriptDownload({
        scriptId: 'mock-script-id', // Assumes scriptId in dot-clasp-dist.json
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
      expect(out.stdout).to.contain('Pushed 2 files'); // appsscript.json and Code.js from 'dist/'
    });

    // Test handling of manifest update when user confirms via interactive prompt.
    it('should handle manifest update prompt and push if confirmed', async function () {
      // Setup local manifest different from what mockScriptDownload will return as "remote".
      mockfs({
        'appsscript.json': '{ "timeZone": "America/Los_Angeles", "exceptionLogging": "STACKDRIVER" }', // Local change
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      forceInteractiveMode(true); // Ensure interactive prompt.
      // Simulate remote manifest being different (empty source).
      mockScriptDownload({
        scriptId: 'mock-script-id',
        files: [{name: 'appsscript', type: 'JSON', source: '{"timeZone":"UTC"}'}],
      });
      mockScriptPush({scriptId: 'mock-script-id'});
      // Stub inquirer to simulate user confirming the overwrite.
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({overwrite: true});
      const out = await runCommand(['push']);
      promptStub.restore();
      expect(out.stdout).to.contain('Pushed 2 files'); // Manifest and Code.js
    });

    // Test skipping push when user rejects manifest update via interactive prompt.
    it('should skip push on manifest update reject', async function () {
      mockfs({ // Similar setup as above with a changed local manifest.
        'appsscript.json': '{ "timeZone": "America/New_York" }',
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      forceInteractiveMode(true);
      // Simulate remote manifest being different.
      mockScriptDownload({
        scriptId: 'mock-script-id',
        files: [{name: 'appsscript', type: 'JSON', source: '{"timeZone":"UTC"}'}],
      });
      // mockScriptPush should not be called if user rejects.
      const pushMock = mockScriptPush({scriptId: 'mock-script-id'});
      // Stub inquirer to simulate user denying the overwrite.
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({overwrite: false});
      const out = await runCommand(['push']);
      promptStub.restore();
      expect(out.stdout).to.contain('Push canceled by user'); // Check for skip message.
      expect(out.stdout).to.not.contain('Pushed'); // Should not have pushed any files.
      expect(pushMock.isDone()).to.be.false; // Verify the push API was not called.
    });
  });

  // Tests for attempting to push when no local .clasp.json project file is configured.
  describe('Without local project (.clasp.json missing), authenticated', function () {
    beforeEach(function () {
      // Mock filesystem with only authentication, no .clasp.json.
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
