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
 * @fileoverview Integration tests for the `clasp list-apis` (or `clasp apis`) command.
 * These tests verify that the command correctly:
 * - Lists APIs that are currently enabled in the linked GCP project and are recognized as
 *   Apps Script Advanced Services.
 * - Lists all available Apps Script Advanced Services that can be enabled.
 * - Filters out services that are not relevant as Apps Script Advanced Services.
 */

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockListApis, mockListEnabledServices, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite for the 'clasp list-apis' command.
describe('List APIs command', function () {
  // Setup mocks before each test and reset after.
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for listing APIs when a .clasp.json (with GCP project ID) exists and the user is authenticated.
  describe('With project (including GCP ID), authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with .clasp.json containing a GCP project ID and authenticated .clasprc.json.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test that currently enabled advanced services are listed.
    it('should list enabled APIs', async function () {
      // Mock the Google Discovery API for available services and Service Usage API for enabled ones.
      mockListApis(); // Provides the list of all possible services clasp might consider.
      mockListEnabledServices({ // Simulates 'docs' as an enabled service in GCP.
        projectId: 'mock-gcp-project', // Must match projectId in dot-clasp-gcp-project.json.
      });
      const out = await runCommand(['list-apis']);
      // Expect 'docs' (which is mocked as enabled and is an advanced service) to be listed under "Currently enabled APIs".
      expect(out.stdout).to.contain('# Currently enabled APIs for project mock-gcp-project:\ndocs');
    });

    // Test that available advanced services (not necessarily enabled) are listed.
    it('should list available APIs', async function () {
      mockListApis(); // Provides 'gmail' as an available advanced service.
      mockListEnabledServices({ // Mocks enabled services (can be empty or different for this test).
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis']);
      // Expect 'gmail' (from the mocked discovery list and PUBLIC_ADVANCED_SERVICES) to be under "List of available APIs".
      expect(out.stdout).to.contain('gmail');
    });

    // Test that services returned by APIs but not in PUBLIC_ADVANCED_SERVICES are filtered out.
    it('should hide non-advanced services', async function () {
      mockListApis(); // `mockListApis` includes an 'ignored' service not in PUBLIC_ADVANCED_SERVICES.
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis']);
      // Expect 'ignored' service not to be present in either list.
      return expect(out.stdout).to.not.contain('ignored');
    });
  });
});
