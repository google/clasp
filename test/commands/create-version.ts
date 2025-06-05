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
 * @fileoverview Integration tests for the `clasp create-version` (or `clasp version`) command.
 * These tests cover scenarios such as:
 * - Creating a new immutable version of a script.
 * - Prompting for a description in interactive mode if not provided.
 * - Using a description provided as a command-line argument.
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
import {forceInteractiveMode, mockCreateVersion, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp create-version' command.
describe('Create version command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for creating versions when a .clasp.json file exists and the user is authenticated.
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

    // Test creating a version when no description is provided on the command line,
    // expecting an interactive prompt for the description.
    it('should create version and prompt for description when not set', async function () {
      // Mock the API call to create a version, expecting 'test version' as description from the prompt.
      mockCreateVersion({
        scriptId: 'mock-script-id',
        description: 'test version', // This description should match what the stubbed prompt returns.
        version: 1,
      });
      forceInteractiveMode(true); // Ensure isInteractive() returns true.
      // Stub inquirer.prompt to simulate user entering 'test version'.
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({description: 'test version'});
      const out = await runCommand(['create-version']);
      promptStub.restore(); // Restore original inquirer.prompt.
      expect(out.stdout).to.contain('Created version');
    });

    // Test creating a version with the description provided as a command-line argument.
    it('should use provided description', async function () {
      // Mock the API call, expecting the description 'test'.
      mockCreateVersion({
        scriptId: 'mock-script-id',
        description: 'test',
        version: 1,
      });
      const out = await runCommand(['create-version', 'test']); // 'test' is the description argument.
      return expect(out.stdout).to.contain('Created version');
    });
  });
});
