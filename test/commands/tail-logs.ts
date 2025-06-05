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
 * @fileoverview Integration tests for the `clasp tail-logs` (or `clasp logs`) command.
 * These tests verify the command's ability to:
 * - Display Cloud Logs for a project.
 * - Format logs as plain text, JSON, or simplified text.
 * - Prompt for a GCP project ID if not configured and in interactive mode.
 * - Handle cases where the GCP project ID is missing in non-interactive mode.
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
import {mockListLogEntries, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../../test/mocks.js';
import {forceInteractiveMode} from '../../test/mocks.js';
import {useChaiExtensions} from '../helpers.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp tail-logs' command.
describe('Tail logs command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for tailing logs when a .clasp.json file with a GCP project ID exists and the user is authenticated.
  describe('With GCP project configured, authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with .clasp.json containing a GCP projectId and authenticated .clasprc.json.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-gcp-project.json')), // This fixture should have a projectId.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test default log output format.
    it('should print logs in default format', async function () {
      // Mock the API call to list log entries.
      mockListLogEntries({
        projectId: 'mock-gcp-project', // Must match projectId in the .clasp.json fixture.
      });
      const out = await runCommand(['tail-logs']);
      expect(out.stdout).to.contain('INFO'); // Check for severity.
      expect(out.stdout).to.contain('myFunction'); // Check for function name.
      expect(out.stdout).to.contain('test log'); // Check for payload.
      expect(out.stdout).to.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Check for timestamp.
    });

    // Test JSON output format.
    it('should print logs in JSON format when --json is used', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['tail-logs', '--json']);
      // Check for characteristic JSON output elements.
      expect(out.stdout).to.contain('"severity": "INFO"');
      expect(out.stdout).to.contain('"function_name": "myFunction"');
      expect(out.stdout).to.contain('"textPayload": "test log"');
    });

    // Test simplified output format (no timestamps).
    it('should print logs without timestamps when --simplified is used', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['tail-logs', '--simplified']);
      expect(out.stdout).to.contain('INFO');
      expect(out.stdout).to.contain('myFunction');
      expect(out.stdout).to.contain('test log');
      expect(out.stdout).to.not.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Timestamp should be absent.
    });

    // Test interactive prompt for GCP project ID if not found in .clasp.json.
    it('should prompt for project ID if not configured and in interactive mode', async function () {
      // Override mock filesystem to use a .clasp.json without a projectId.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')), // No projectId here.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockListLogEntries({
        projectId: 'entered-mock-gcp-project', // Simulate this ID will be entered by the user.
      });
      forceInteractiveMode(true); // Ensure interactive mode.
      // Stub inquirer.prompt to simulate user entering the project ID.
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({projectId: 'entered-mock-gcp-project'});
      const out = await runCommand(['tail-logs']);
      promptStub.restore();
      expect(out.stdout).to.contain('INFO'); // Logs should be fetched after projectId is provided.
    });

    // Test using the 'logs' alias for the command.
    it('should work with "logs" alias', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['logs']); // Using the alias.
      expect(out.stdout).to.contain('INFO');
    });
  });

  // Tests for scenarios where GCP project ID might be missing.
  describe('Without GCP project configured, authenticated', function () {
    beforeEach(function () {
      // Filesystem with .clasp.json that *lacks* a projectId.
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
