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
 * @fileoverview Integration tests for the `clasp create` (or `clasp create-script`) command.
 * These tests cover scenarios such as:
 * - Creating a new standalone Apps Script project with a default or specified title.
 * - Creating a new container-bound script (e.g., for Google Sheets).
 * - Using a custom root directory for the new project.
 * - Error handling when a project already exists in the directory.
 */

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {getDefaultProjectName} from '../../src/commands/create-script.js';
import {useChaiExtensions} from '../helpers.js';
import {
  mockCreateBoundScript,
  mockCreateScript,
  mockOAuthRefreshRequest,
  mockScriptDownload,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp create' command.
describe('Create script command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for creating new projects in a directory without an existing .clasp.json file.
  // Assumes the user is authenticated.
  describe('In a clean directory, authenticated', function () { // Renamed for clarity
    beforeEach(function () {
      // Set up a mock filesystem with an authenticated .clasprc.json but no .clasp.json.
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test creating a standalone script with the default title (inferred from current directory).
    // Note: The 'it' description "should create a version" seems like a misnomer for a 'create-script' test.
    // It should probably be "should create a standalone script with default title".
    it('should create a standalone script with default title', async function () {
      // Mock the API call to create a new standalone script.
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: getDefaultProjectName(process.cwd()), // Expects title to be inferred.
      });
      // Mock the subsequent download of the newly created script's files.
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create']);
      expect('appsscript.json').to.be.a.realFile();
      expect('Code.js').to.be.a.realFile();
      expect(out.stdout).to.contain('Cloned'); // Indicates files were pulled after creation.
    });

    // Test creating a container-bound script (e.g., for a Google Sheet).
    it('should create a bound script', async function () {
      // Mock the API calls for creating a new Google Sheet and then a script bound to it.
      mockCreateBoundScript({
        scriptId: 'mock-script-id',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        title: 'test sheet',
      });
      // Mock the download of files for the new bound script.
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--type', 'sheets', '--title', 'test sheet']);
      expect('appsscript.json').to.be.a.realFile();
      expect('Code.js').to.be.a.realFile();
      expect(out.stdout).to.contain('Cloned');
    });

    // Test creating a standalone script with a user-provided title.
    it('should create a standalone script with given title', async function () {
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: 'test', // Expect this specific title.
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--title', 'test']);
      expect('appsscript.json').to.be.a.realFile();
      expect('Code.js').to.be.a.realFile();
      expect(out.stdout).to.contain('Cloned');
    });

    // Test creating a script and placing its files in a specified root directory.
    it('should use the given root directory', async function () {
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: 'test',
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--title', 'test', '--rootDir', 'dist']);
      // Expect files to be created inside the 'dist' subdirectory.
      expect('dist/appsscript.json').to.be.a.realFile();
      expect('dist/Code.js').to.be.a.realFile();
      expect(out.stdout).to.contain('Cloned');
    });
  });

  // Tests for attempting to create a script in a directory that already contains a .clasp.json file.
  describe('With existing project, authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with an existing .clasp.json.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should give error if .clasp.json exists', async function () {
      const out = await runCommand(['create']);
      return expect(out.stderr).to.contain('already exists');
    });
  });
});
