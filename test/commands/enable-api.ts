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
 * @fileoverview Integration tests for the `clasp enable-api` command.
 * These tests verify that the command correctly:
 * - Adds a specified service to the `dependencies.enabledAdvancedServices`
 *   array in the `appsscript.json` manifest file.
 * - Calls the Google Service Usage API to enable the service in the linked GCP project.
 * - Handles attempts to enable services that are not valid or recognized.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockEnableService, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp enable-api' command.
describe('Enable API command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for enabling APIs when a .clasp.json (with GCP project ID) and appsscript.json exist,
  // and the user is authenticated.
  describe('With project (including GCP ID), authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with relevant project files.
      // 'appsscript-services.json' can be used as a base, though we're adding to it.
      // 'dot-clasp-gcp-project.json' fixture should contain a GCP project ID.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')), // Start with no services or a base set
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test successfully enabling a new service.
    it('should enable a service in manifest and call GCP API', async function () {
      // Mock the Google Service Usage API call for enabling 'docs'.
      mockEnableService({
        projectId: 'mock-gcp-project', // Must match projectId in dot-clasp-gcp-project.json
        serviceName: 'docs.googleapis.com', // serviceId from PUBLIC_ADVANCED_SERVICES + .googleapis.com
      });

      const out = await runCommand(['enable-api', 'docs']);
      expect(out.stdout).to.contain('Enabled docs API'); // Check for success message.

      // Verify that the service was added to the appsscript.json manifest.
      const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
      expect(manifest.dependencies?.enabledAdvancedServices).to.be.an('array');
      expect(manifest.dependencies.enabledAdvancedServices).to.deep.include({
        userSymbol: 'Docs', // userSymbol from PUBLIC_ADVANCED_SERVICES
        serviceId: 'docs',
        version: 'v1', // Version from PUBLIC_ADVANCED_SERVICES
      });
    });

    // Test attempting to enable a service that is not a valid advanced service.
    it('should reject unknown services', async function () {
      // No API call should be made if the service name is not recognized.
      const out = await runCommand(['enable-api', 'xyz']);
      expect(out.stderr).to.contain('not a valid');
    });
  });
});
