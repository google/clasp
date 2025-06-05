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
 * @fileoverview Integration tests for the `clasp deploy` (or `clasp create-deployment`) command.
 * These tests cover scenarios such as:
 * - Creating a new deployment (which also creates a new version by default).
 * - Deploying a specific version of the script.
 * - Providing a description for a new version/deployment.
 * - Updating an existing deployment with a new version and/or description.
 */

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {
  mockCreateDeployment,
  mockCreateVersion,
  mockOAuthRefreshRequest,
  mockUpdateDeployment,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp deploy' command.
describe('Create deployment command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for deployment operations when a .clasp.json file exists and the user is authenticated.
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

    // Test creating a new deployment. This implicitly creates a new version.
    it('should create version and use default description', async function () {
      // Mock the API call to create a new version.
      mockCreateVersion({
        scriptId: 'mock-script-id',
        version: 1, // Expect version 1 to be created.
      });
      // Mock the API call to create a new deployment using the new version.
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        version: 1, // Deployment should be for version 1.
      });
      const out = await runCommand(['deploy']);
      expect(out.stdout).to.contain('Deployed mock-deployment-id @1');
    });

    // Test deploying an existing version number.
    it('should use provided version id', async function () {
      // Mock the API call to create a deployment for an existing version.
      // No mockCreateVersion needed as we're specifying an existing version.
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        version: 2, // Deploying specific version 2.
      });
      const out = await runCommand(['deploy', '-V', '2']);
      expect(out.stdout).to.contain('Deployed mock-deployment-id @2');
    });

    // Test providing a description for a new version and deployment.
    it('should use provided description', async function () {
      // Mock creating a new version with the specified description.
      mockCreateVersion({
        scriptId: 'mock-script-id',
        description: 'test',
        version: 1,
      });
      // Mock creating a new deployment with that version and description.
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        description: 'test',
        version: 1,
      });
      const out = await runCommand(['deploy', '-d', 'test']);
      expect(out.stdout).to.contain('Deployed mock-deployment-id @1');
    });

    // Test updating an existing deployment ID with a specific version.
    it('should update existing deployment', async function () {
      // Mock the API call to update an existing deployment.
      mockUpdateDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id', // Target existing deployment.
        version: 2, // Update to version 2.
      });
      const out = await runCommand(['deploy', '-i', 'mock-deployment-id', '-V', '2']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @2');
    });
  });
});
