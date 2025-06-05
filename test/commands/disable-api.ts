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
 * @fileoverview Integration tests for the `clasp disable-api` command.
 * These tests verify that the command correctly:
 * - Removes a specified service from the `dependencies.enabledAdvancedServices`
 *   array in the `appsscript.json` manifest file.
 * - Calls the Google Service Usage API to disable the service in the linked GCP project.
 * - Handles attempts to disable services that are not valid or recognized.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockDisableService, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp disable-api' command.
describe('Disable API command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for disabling APIs when a .clasp.json (with GCP project ID) and appsscript.json exist,
  // and the user is authenticated.
  describe('With project (including GCP ID and services in manifest), authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with relevant project files.
      // 'appsscript-services.json' fixture should contain services to be disabled.
      // 'dot-clasp-gcp-project.json' fixture should contain a GCP project ID.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-services.json')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test successfully disabling a service.
    it('should disable a service in manifest and call GCP API', async function () {
      // Mock the Google Service Usage API call for disabling 'gmail'.
      mockDisableService({
        projectId: 'mock-gcp-project', // Must match projectId in dot-clasp-gcp-project.json
        serviceName: 'gmail.googleapis.com', // serviceId from PUBLIC_ADVANCED_SERVICES + .googleapis.com
      });

      const out = await runCommand(['disable-api', 'gmail']);
      expect(out.stdout).to.contain('Disabled gmail API'); // Check for success message.

      // Verify that the service was removed from the appsscript.json manifest.
      const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
      expect(manifest.dependencies?.enabledAdvancedServices).to.be.an('array');
      // Assuming 'gmail' was in the fixture, it should now be absent.
      expect(manifest.dependencies.enabledAdvancedServices).to.not.deep.include({
        userSymbol: 'Gmail', // userSymbol from PUBLIC_ADVANCED_SERVICES
        serviceId: 'gmail',
        version: 'v1', // Version from PUBLIC_ADVANCED_SERVICES
      });
    });

    // Test attempting to disable a service that is not a valid advanced service.
    it('should reject unknown services', async function () {
      // No API call should be made if the service name is not recognized.
      const out = await runCommand(['disable-api', 'xyz']);
      expect(out.stderr).to.contain('not a valid');
    });
  });
});
