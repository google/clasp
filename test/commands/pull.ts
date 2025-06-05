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
 * @fileoverview Integration tests for the `clasp pull` command.
 * These tests cover various scenarios for pulling files from an Apps Script project, including:
 * - Basic pull operation.
 * - Pulling files into a specified root directory.
 * - Pulling a specific version of the project.
 * - Handling errors during script download.
 * - Deleting local files not present in the remote project, with and without prompting.
 * - Behavior when no local project (.clasp.json) is configured.
 */

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
  mockScriptDownloadError,
  resetMocks,
  setupMocks,
} from '../../test/mocks.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp pull' command.
describe('Pull command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for pulling files when a local .clasp.json project file exists and the user is authenticated.
  describe('With local project (.clasp.json exists), authenticated', function () {
    beforeEach(function () {
      // Default mock filesystem setup for this describe block.
      // Individual tests can override this by calling mockfs() again.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test basic pull functionality.
    it('should pull files', async function () {
      // Mock the API call to download script content.
      mockScriptDownload({
        scriptId: 'mock-script-id', // Assumes scriptId in fixture is 'mock-script-id'.
      });
      const out = await runCommand(['pull']);
      expect('appsscript.json').to.be.a.realFile();
      expect('Code.js').to.be.a.realFile();
      expect(out.stdout).to.contain('Pulled 2 files'); // Based on mockScriptDownload default.
    });

    // Test pulling files into a specified root directory (rootDir in .clasp.json).
    it('should pull files into the rootDir', async function () {
      // Override mock filesystem to use .clasp.json that specifies a 'rootDir'.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-dist.json')), // This fixture sets "rootDir": "dist"
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id', // Assumes scriptId in dot-clasp-dist.json is 'mock-script-id'.
      });
      const out = await runCommand(['pull']);
      // Files should be placed inside the 'dist' directory.
      expect('dist/appsscript.json').to.be.a.realFile();
      expect('dist/Code.js').to.be.a.realFile();
      expect(out.stdout).to.contain('Pulled 2 files');
    });

    // Test pulling a specific version of the project.
    it('should pull a specific version', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
        version: 3, // Requesting version 3.
      });
      const out = await runCommand(['pull', '--versionNumber', '3']);
      expect('appsscript.json').to.be.a.realFile();
      expect('Code.js').to.be.a.realFile();
      expect(out.stdout).to.contain('Pulled 2 files');
    });

    // Test error handling when script download fails.
    it('should handle script download error', async function () {
      mockScriptDownloadError({ // Simulate an API error during download.
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['pull']);
      expect(out.stdout).to.not.contain('Pulled 2 files'); // Success message should not be present.
      expect(out.exitCode).to.not.equal(0); // Command should exit with an error code.
    });

    // Test deleting unused local files with interactive confirmation (user confirms deletion).
    it('should prompt to delete unused files and delete when confirmed', async function () {
      // Setup filesystem with an extra local file not in the standard mock download.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        'local-only.js': 'console.log("local only");', // This file should be identified as unused.
        'ignored.txt': 'ignored file', // Assume this would be ignored by .claspignore if one were present.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({ // Remote project only has appsscript.json and Code.js by default.
        scriptId: 'mock-script-id',
      });
      forceInteractiveMode(true); // Ensure interactive prompt.
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({deleteFile: true}); // Simulate user confirming deletion.
      const out = await runCommand(['pull', '--deleteUnusedFiles']);
      sinon.assert.called(promptStub); // Verify prompt was shown.
      promptStub.restore();
      expect(out.stdout).to.contain('Deleted local-only.js');
      expect(out.stdout).to.contain('Pulled 2 files');
      expect('local-only.js').to.not.be.a.realFile(); // File should be deleted.
      expect('ignored.txt').to.be.a.realFile(); // Should remain if not part of project & not targeted for deletion.
    });

    // Test deleting unused local files with interactive confirmation (user denies deletion).
    it('should prompt to delete unused files and not delete when not confirmed', async function () {
      mockfs({ // Similar setup as above.
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        'local-only.js': 'console.log("local only");',
        'ignored.txt': 'ignored file',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      forceInteractiveMode(true);
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({deleteFile: false}); // Simulate user denying deletion.
      const out = await runCommand(['pull', '--deleteUnusedFiles']);
      sinon.assert.called(promptStub);
      promptStub.restore();
      expect(out.stdout).to.not.contain('Deleted local-only.js');
      expect(out.stdout).to.contain('Pulled 2 files');
      expect('local-only.js').to.be.a.realFile(); // File should still exist.
      expect('ignored.txt').to.be.a.realFile();
    });

    // Test deleting unused local files with the --force flag, skipping the prompt.
    it('should delete unused files without prompting when force flag is used', async function () {
      mockfs({ // Similar setup.
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        'local-only.js': 'console.log("local only");',
        'ignored.txt': 'ignored file',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const promptStub = sinon.stub(inquirer, 'prompt'); // This should not be called.
      const out = await runCommand(['pull', '--deleteUnusedFiles', '--force']);
      sinon.assert.notCalled(promptStub); // Verify prompt was skipped.
      promptStub.restore();
      // Output might or might not explicitly state deletion, depends on command's verbosity.
      // Main check is that the command succeeded and file is gone.
      expect(out.stdout).to.contain('Pulled 2 files');
      expect('local-only.js').to.not.be.a.realFile(); // File should be deleted.
      expect('ignored.txt').to.be.a.realFile();
    });
  });

  // Tests for attempting to pull when no local .clasp.json project file is configured.
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
      const out = await runCommand(['pull']);
      expect(out.stderr).to.contain('not found');
    });
  });
});
