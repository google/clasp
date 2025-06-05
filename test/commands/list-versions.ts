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
 * @fileoverview Integration tests for the `clasp list-versions` (or `clasp versions`) command.
 * These tests verify that the command correctly lists the immutable versions
 * of an Apps Script project.
 */

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockListVersions, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp list-versions' command.
describe('List versions command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for listing versions when a .clasp.json file exists and the user is authenticated.
  describe('With project, authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with .clasp.json and authenticated .clasprc.json.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test that the command successfully lists script versions.
    // The 'it' description was "should list scripts", corrected to "should list versions".
    it('should list versions', async function () {
      // Mock the API call to list versions for the project.
      mockListVersions({scriptId: 'mock-script-id'}); // Assumes scriptId in fixture is 'mock-script-id'.
      const out = await runCommand(['list-versions']);
      // Check if the output contains an expected version description from the mock.
      expect(out.stdout).to.contain('Test version 1');
    });
  });
});
