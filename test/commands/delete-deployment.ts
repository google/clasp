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
 * @fileoverview Integration tests for the `clasp delete-deployment` (or `clasp undeploy`) command.
 * These tests cover scenarios such as:
 * - Deleting a specific deployment by its ID.
 * - Interactively prompting the user to select a deployment to delete when no ID is provided.
 * - Using the `--all` flag to delete all existing deployments for a project.
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
  mockDeleteDeployment,
  mockListDeployments,
  mockOAuthRefreshRequest,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp delete-deployment' command.
describe('Delete deployment command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for deleting deployments when a .clasp.json file exists and the user is authenticated.
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

    // Test deleting a deployment by providing its ID directly.
    it('should delete a deployment', async function () {
      // Mock the API call to delete the specified deployment.
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
      });
      const out = await runCommand(['delete-deployment', 'mock-deployment-id']);
      expect(out.stdout).to.contain('Deleted deployment');
    });

    // Test interactive prompt for deployment ID when none is provided.
    it('should prompt for deployment', async function () {
      // Mock listing deployments to provide choices for the prompt.
      mockListDeployments({scriptId: 'mock-script-id'});
      // Mock deletion of the deployment that will be "selected" by the stubbed prompt.
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id', // This ID should match the stubbed prompt's resolution.
      });
      forceInteractiveMode(true); // Ensure isInteractive() returns true.
      // Stub inquirer.prompt to simulate user selecting 'mock-deployment-id'.
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({deploymentId: 'mock-deployment-id'});
      const out = await runCommand(['delete-deployment']);
      promptStub.restore(); // Restore original inquirer.prompt.
      expect(out.stdout).to.contain('Deleted deployment');
    });

    // Test deleting all deployments using the --all flag.
    it('should delete all if specified', async function () {
      // Mock listing deployments, which will be iterated through for deletion.
      mockListDeployments({scriptId: 'mock-script-id'});
      // Mock the deletion for each deployment that `mockListDeployments` returns (excluding HEAD deployments).
      // This assumes `mockListDeployments` returns 'mock-deployment-id' and 'mock-deployment-id-2' as deletable.
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
      });
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id-2',
      });
      const out = await runCommand(['delete-deployment', '--all']);
      return expect(out.stdout).to.contain('Deleted all');
    });
  });
});
