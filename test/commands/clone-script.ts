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
 * @fileoverview Integration tests for the `clasp clone` command.
 * These tests cover various scenarios including:
 * - Cloning by script ID or URL.
 * - Cloning a specific version of a script.
 * - Using a custom root directory for the cloned project.
 * - Interactive prompts when no script ID is provided.
 * - Error handling for invalid script IDs or existing projects.
 */

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {useChaiExtensions} from '../helpers.js';
import {
  forceInteractiveMode,
  mockListScripts,
  mockOAuthRefreshRequest,
  mockScriptDownload,
  mockScriptDownloadError,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp clone' command.
describe('Clone script command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks(); // Sets up nock and mock-fs.
    mockOAuthRefreshRequest(); // Mocks the OAuth token refresh request.
  });

  afterEach(function () {
    resetMocks(); // Restores filesystem and nock.
  });

  // Tests for cloning into a directory that does not already contain a .clasp.json project file.
  // Assumes the user is authenticated.
  describe('With clean dir, authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with an authenticated .clasprc.json file.
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should clone a project with scriptId correctly', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'mock-script-id']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should clone a project with script URL correctly', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'https://script.google.com/d/mock-script-id/edit']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should clone a specfic version', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
        version: 2,
      });
      const out = await runCommand(['clone', 'mock-script-id', '2']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should use the provided root directory', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'mock-script-id', '--rootDir', 'dist']);
      expect('dist/appsscript.json').to.be.a.realFile;
      expect('dist/Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should prompt if no script provided', async function () {
      mockListScripts();
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      // Mock the API call to list available scripts for the user to choose from.
      mockListScripts();
      // Mock the download of the selected script's content.
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      forceInteractiveMode(true); // Ensure `isInteractive()` returns true for this test.
      // Stub `inquirer.prompt` to simulate user selecting 'mock-script-id'.
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({scriptId: 'mock-script-id'});
      const out = await runCommand(['clone']);
      promptStub.restore(); // Restore original inquirer.prompt behavior.
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should give an error if no script and not interactive', async function () {
      forceInteractiveMode(false);
      const out = await runCommand(['clone']);
      return expect(out.stderr).to.contain('No script ID');
    });

    it('should give an error on a non-existing project', async function () {
      mockScriptDownloadError({
        scriptId: 'non-existing-project',
      });
      const out = await runCommand(['clone', 'non-existing-project']);
      return expect(out.stderr).to.contain('Invalid script ID');
    });

    // This test verifies that if the script download (clone) fails,
    // the .clasp.json file (project configuration) is not created locally.
    it('should not write .clasp.json if unable to clone', async function () {
      // Mock an error response for the script content download.
      mockScriptDownloadError({
        scriptId: 'mock-script-id',
      });
      await runCommand(['clone', 'mock-script-id']);
      // Assert that the .clasp.json file was not created.
      expect('.clasp.json').to.not.be.a.realFile();
    });
  });

  // Tests for attempting to clone into a directory that already contains a .clasp.json file.
  // Assumes the user is authenticated.
  describe('With existing project, authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with an existing .clasp.json and authenticated .clasprc.json.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should give error if .clasp.json exists', async function () {
      const out = await runCommand(['clone', 'mock-id']);
      return expect(out.stderr).to.contain('already exists');
    });
  });
});
