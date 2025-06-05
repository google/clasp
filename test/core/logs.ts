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
 * @fileoverview Unit and integration tests for the `Logs` class in `src/core/logs.ts`.
 * These tests cover fetching log entries from Google Cloud Logging, including
 * scenarios with and without a configured GCP project ID, and with different
 * authentication states.
 */

import os from 'os';
import path from 'path';

import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import nock from 'nock';
import {initClaspInstance} from '../../src/core/clasp.js';
import {useChaiExtensions} from '../helpers.js';
import {resetMocks, setupMocks} from '../mocks.js';

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
 * Helper function to define shared test cases for scenarios where log operations
 * are expected to fail, typically due to missing scriptId or projectId configuration.
 */
function shouldFailLogOperationsWhenNotSetup() {
  it('should fail to get log entries due to missing project configuration', async function () {
    const clasp = await initClaspInstance({credentials: mockCredentials()});
    // Expect rejection because scriptId (and thus projectId for logs) is not configured.
    // The error message might vary based on which assertion (scriptId or projectId) fails first.
    return expect(clasp.logs.getLogEntries()).to.eventually.be.rejectedWith(Error, /Project settings not found|GCP project ID is not set/);
  });
}

// Main test suite for log operations.
describe('Log operations', function () {
  // Common setup and teardown.
  beforeEach(function () {
    setupMocks();
  });

  afterEach(function () {
    resetMocks();
  });

  // Tests for when no .clasp.json exists and user is not authenticated.
  describe('with no local project and no credentials', function () {
    beforeEach(function () {
      mockfs({}); // Empty filesystem.
    });
    it('should fail to get log entries (auth error)', async function () {
      const clasp = await initClaspInstance({}); // No credentials
      return expect(clasp.logs.getLogEntries()).to.eventually.be.rejectedWith(Error, /User is not authenticated/);
    });
    afterEach(mockfs.restore);
  });

  // Tests for when no .clasp.json exists, but user is authenticated.
  describe('with no local project, but authenticated', function () {
    beforeEach(function () {
      mockfs({ // Only .clasprc.json, no .clasp.json.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    // Shared tests for failing log operations due to no project config.
    shouldFailLogOperationsWhenNotSetup();
    afterEach(mockfs.restore);
  });

  // Tests for when a .clasp.json with GCP project ID exists and user is authenticated.
  describe('with GCP project configured and authenticated', function () {
    beforeEach(function () {
      // Mock filesystem with .clasp.json having a projectId and an authenticated .clasprc.json.
      mockfs({
        // 'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        // 'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')), // This fixture must contain a projectId.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    afterEach(mockfs.restore); // Clean up mock filesystem.

    // Test fetching log entries without a 'since' filter.
    it('should get log entries without a "since" date', async function () {
      // Mock the Google Cloud Logging API endpoint.
      nock('https://logging.googleapis.com')
        .post(/\/v2\/entries:list/, body => {
          // Assertions on the request body sent to the Logging API.
          expect(body.resourceNames).to.eql(['projects/mock-gcp-project']); // From dot-clasp-gcp-project.json
          expect(body.filter).to.equal(''); // No 'since' date means empty filter for time.
          expect(body.orderBy).to.equal('timestamp desc');
          expect(body.pageSize).to.equal(100); // Default page size from fetchWithPages.
          return true;
        })
        .reply(200, { // Simulate a successful API response.
          entries: [{timestamp: '2023-10-27T10:00:00Z', logName: 'projects/mock-gcp-project/logs/stdout', severity: 'INFO'}],
          nextPageToken: undefined,
        });

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const logs = await clasp.logs.getLogEntries();
      expect(logs.results).to.have.lengthOf(1);
      expect(logs.results[0].logName).to.eql('projects/mock-gcp-project/logs/stdout');
    });

    // Test fetching log entries with a 'since' filter.
    it('should get log entries filtered by a "since" date', async function () {
      const sinceDate = new Date('2023-10-26T10:00:00.000Z');
      nock('https://logging.googleapis.com')
        .post(/\/v2\/entries:list/, body => {
          expect(body.resourceNames).to.eql(['projects/mock-gcp-project']);
          // Verify the timestamp filter is correctly formatted.
          expect(body.filter).to.equal(`timestamp >= "${sinceDate.toISOString()}"`);
          expect(body.orderBy).to.equal('timestamp desc');
          return true;
        })
        .reply(200, {
          entries: [{timestamp: '2023-10-27T10:00:00Z', logName: 'projects/mock-gcp-project/logs/stdout', severity: 'INFO'}],
          nextPageToken: undefined,
        });

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const logs = await clasp.logs.getLogEntries(sinceDate);
      expect(logs.results).to.have.lengthOf(1);
      expect(logs.results[0].logName).to.eql('projects/mock-gcp-project/logs/stdout');
    });
  });

  // Tests for scenarios where .clasp.json is missing a projectId, but user is authenticated.
  describe('with local project missing GCP ID, authenticated', function () {
    beforeEach(function () {
      // Mock filesystem with .clasp.json that *lacks* a projectId.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')), // No projectId in this fixture.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    afterEach(mockfs.restore);
    shouldFailLogOperationsWhenNotSetup();
  });
});
