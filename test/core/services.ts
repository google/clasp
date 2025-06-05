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
 * @fileoverview Unit and integration tests for the `Services` class in `src/core/services.ts`.
 * These tests cover scenarios for listing available and enabled Advanced Google Services,
 * as well as enabling and disabling these services for an Apps Script project.
 * Tests include checks for manifest file updates and interactions with mocked Google APIs.
 */

import os from 'os';
import path from 'path';

import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {initClaspInstance} from '../../src/core/clasp.js';
import {useChaiExtensions} from '../helpers.js';
import {
  mockDisableService,
  mockEnableService,
  mockListApis,
  mockListEnabledServices,
  resetMocks,
  setupMocks,
} from '../mocks.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a mock OAuth2Client instance for testing.
 * @returns A mock OAuth2Client.
 */
function mockCredentials(): OAuth2Client {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: 'mock-access-token',
  });
  return client;
}

/**
 * Helper function to define shared test cases for scenarios where service operations
 * are expected to fail due to missing GCP project ID or script ID configuration.
 */
function shouldFailServiceOperationsWhenNotSetup() {
  const expectedErrorMessage = /GCP project ID is not set|Project settings not found/; // Error can be due to missing scriptId or projectId

  it('should fail to list enabled APIs if project/GCP config is missing', async function () {
    const clasp = await initClaspInstance({credentials: mockCredentials()});
    return expect(clasp.services.getEnabledServices()).to.eventually.be.rejectedWith(Error, expectedErrorMessage);
  });

  it('should fail to enable APIs if project/GCP config is missing', async function () {
    const clasp = await initClaspInstance({credentials: mockCredentials()});
    return expect(clasp.services.enableService('sheets')).to.eventually.be.rejectedWith(Error, expectedErrorMessage);
  });

  it('should fail to disable APIs if project/GCP config is missing', async function () {
    const clasp = await initClaspInstance({credentials: mockCredentials()});
    return expect(clasp.services.disableService('sheets')).to.eventually.be.rejectedWith(Error, expectedErrorMessage);
  });
}

// Main test suite for service operations.
describe('Service operations', function () {
  // Common setup and teardown for mocks.
  beforeEach(function () {
    setupMocks();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for scenarios with no local .clasp.json and no authentication.
  describe('with no local project and no credentials', function () {
    beforeEach(function () {
      mockfs({}); // Empty filesystem.
    });
    // Service operations require authentication and project configuration.
    it('should fail to list enabled APIs (auth error)', async function () {
      const clasp = await initClaspInstance({}); // No credentials
      return expect(clasp.services.getEnabledServices()).to.eventually.be.rejectedWith(Error, /User is not authenticated/);
    });
    // Not repeating all service operations as they would fail similarly due to auth.
  });

  // Tests for scenarios with no local .clasp.json, but user is authenticated.
  describe('with no local project, but authenticated', function () {
    beforeEach(function () {
      mockfs({ // Only .clasprc.json, no .clasp.json.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    // Shared tests for failing service operations due to missing project/GCP configuration.
    shouldFailServiceOperationsWhenNotSetup();
  });

  // Tests for scenarios with a configured .clasp.json (including GCP project ID),
  // an appsscript.json manifest, and authenticated user.
  describe('with configured project (including GCP ID and manifest) and authenticated', function () {
    beforeEach(function () {
      // Mock filesystem with a project that has a GCP project ID and a manifest with some services.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-services.json')), // Contains 'Gmail' and 'Drive' services.
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')), // Contains 'mock-gcp-project' as projectId.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test listing available advanced services.
    it('should list available Advanced Google Services', async function () {
      // `getAvailableServices` currently uses the hardcoded PUBLIC_ADVANCED_SERVICES list.
      // No nock needed unless it's changed to use discovery API.
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const services = await clasp.services.getAvailableServices();
      // Check if a known service (e.g., 'docs') is present in the available list.
      expect(services.find(s => s.name === 'docs')).to.not.be.undefined;
      expect(services.length).to.equal(PUBLIC_ADVANCED_SERVICES.length);
    });

    // Test listing currently enabled advanced services.
    it('should list enabled Advanced Google Services from GCP and filter by known advanced services', async function () {
      // Mock the Service Usage API to return a list of enabled services in GCP.
      // The mockListEnabledServices in mocks.ts should return 'docs.googleapis.com' as enabled.
      mockListEnabledServices({
        projectId: 'mock-gcp-project', // Must match projectId in the .clasp.json fixture.
      });
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const services = await clasp.services.getEnabledServices();
      // 'docs' is in PUBLIC_ADVANCED_SERVICES and mocked as enabled.
      expect(services.find(s => s.name === 'docs')).to.not.be.undefined;
      // Ensure only services also in PUBLIC_ADVANCED_SERVICES are listed.
      const publicAdvServiceNames = PUBLIC_ADVANCED_SERVICES.map(s => s.serviceId);
      services.forEach(s => expect(publicAdvServiceNames).to.include(s.name));
    });

    // Test enabling an advanced service.
    it('should enable an API in the manifest and call the GCP Service Usage API', async function () {
      // Mock the Service Usage API for enabling 'sheets.googleapis.com'.
      mockEnableService({
        projectId: 'mock-gcp-project',
        serviceName: 'sheets.googleapis.com', // Service to enable.
      });
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      // Enable 'sheets' service (assuming it's not already in appsscript-services.json or we want to ensure it's added).
      await clasp.services.enableService('sheets');
      const manifest = await clasp.project.readManifest(); // Read the updated manifest.
      // Verify 'sheets' is now in enabledAdvancedServices.
      expect(manifest.dependencies?.enabledAdvancedServices).to.deep.include({
        userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4', // Details from PUBLIC_ADVANCED_SERVICES
      });
    });

    // Test disabling an advanced service.
    it('should disable an API in the manifest and call the GCP Service Usage API', async function () {
      // Mock the Service Usage API for disabling 'gmail.googleapis.com'.
      // The appsscript-services.json fixture should initially have 'Gmail' enabled.
      mockDisableService({
        projectId: 'mock-gcp-project',
        serviceName: 'gmail.googleapis.com', // Service to disable.
      });
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      await clasp.services.disableService('gmail'); // Disable the 'gmail' service.
      const manifest = await clasp.project.readManifest(); // Read the updated manifest.
      // Verify 'gmail' is no longer in enabledAdvancedServices.
      expect(manifest.dependencies?.enabledAdvancedServices).to.not.deep.include({
        userSymbol: 'Gmail', serviceId: 'gmail', version: 'v1',
      });
    });
  });
});
