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
 * @fileoverview Integration tests for the `clasp list-scripts` (or `clasp list`) command.
 * These tests verify that the command correctly lists Apps Script projects
 * accessible to the authenticated user.
 */

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockListScripts, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp list-scripts' command.
describe('List scripts command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for listing scripts when the user is authenticated.
  // The presence of a local .clasp.json project is not strictly necessary for listing scripts,
  // but the mock setup includes it for consistency with other command tests.
  describe('Authenticated user', function () { // Renamed for clarity
    beforeEach(function () {
      // Set up a mock filesystem with an authenticated .clasprc.json.
      // A .clasp.json is also included, though not directly used by 'list-scripts'.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test that the command successfully lists script projects.
    it('should list scripts', async function () {
      // Mock the API call to Google Drive to list files with the Apps Script MIME type.
      mockListScripts();
      const out = await runCommand(['list-scripts']);
      // Check if the output contains an expected script name from the mock.
      expect(out.stdout).to.contain('script 1');
    });
  });
});
