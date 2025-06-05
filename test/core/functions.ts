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
 * @fileoverview Unit and integration tests for the `Functions` class in `src/core/functions.ts`.
 * These tests cover scenarios for listing and running Apps Script functions,
 * including different argument types, authentication states, and project configurations.
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
 * Helper function to define a reusable set of tests for scenarios where function
 * operations are expected to fail due to missing project configuration (no .clasp.json).
 */
function shouldFailFunctionOperationsWhenNotSetup() {
  it('should fail to run a function with no arguments', async function () {
    const clasp = await initClaspInstance({credentials: mockCredentials()});
    // Expect rejection because no scriptId is configured.
    return expect(clasp.functions.runFunction('myFunction', [])).to.eventually.be.rejectedWith(Error, /Project settings not found/);
  });
  it('should fail to run a function with a string argument', async function () {
    const clasp = await initClaspInstance({credentials: mockCredentials()});
    return expect(clasp.functions.runFunction('myFunction', ['test'])).to.eventually.be.rejectedWith(Error, /Project settings not found/);
  });
  it('should fail to run a function with an object argument', async function () {
    const clasp = await initClaspInstance({credentials: mockCredentials()});
    return expect(clasp.functions.runFunction('myFunction', [{a: 'test'}])).to.eventually.be.rejectedWith(Error, /Project settings not found/);
  });
}

// Main test suite for function operations.
describe('Function operations', function () {
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
      mockfs({}); // Empty filesystem, no .clasp.json or .clasprc.json
    });
    // Define expected failures for running functions.
    // These will fail first on authentication check, then on script config check.
    it('should fail to run a function (auth error)', async function () {
      const clasp = await initClaspInstance({}); // No credentials
      return expect(clasp.functions.runFunction('myFunction', [])).to.eventually.be.rejectedWith(Error, /User is not authenticated/);
    });
    // Not repeating all variations of runFunction as the primary failure point is auth/config.
    afterEach(mockfs.restore);
  });

  // Tests for when no .clasp.json exists, but the user is authenticated (has .clasprc.json).
  describe('with no local project, but authenticated', function () {
    beforeEach(function () {
      mockfs({ // Only .clasprc.json, no .clasp.json
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    // Shared tests for failing function operations due to no project config.
    shouldFailFunctionOperationsWhenNotSetup();
    afterEach(mockfs.restore);
  });

  // Tests for when a .clasp.json project file exists and the user is authenticated.
  describe('with local project and authenticated', function () {
    beforeEach(function () {
      // Mock filesystem with a typical project setup.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')), // Sample local file
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')), // Project config
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load( // Auth config
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    afterEach(mockfs.restore); // Clean up mock filesystem after each test.

    // Test running a function with no arguments.
    it('should run a function with no arguments', async function () {
      // Mock the Apps Script API's scripts.run endpoint.
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => { // Match any script ID.
          // Assertions on the request body sent to the API.
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true; // Default is dev mode.
          expect(body.parameters).to.be.an('array').that.is.empty;
          return true; // Request body is valid.
        })
        .reply(200, { // Simulate a successful API response.
          done: true,
          response: {result: 'Hello'},
        });

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const executionResponse = await clasp.functions.runFunction('myFunction', []);
      // Assert based on the 'result' part of the API's execution response.
      expect(executionResponse?.result).to.equal('Hello');
    });

    // Test running a function with a string argument.
    it('should run a function with a string argument', async function () {
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => {
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true;
          expect(body.parameters).to.deep.equal(['test']); // Check parameters.
          return true;
        })
        .reply(200, {done: true, response: {result: 'Hello test'}});

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const executionResponse = await clasp.functions.runFunction('myFunction', ['test']);
      expect(executionResponse?.result).to.equal('Hello test');
    });

    // Test running a function with an object argument.
    it('should run a function with an object argument', async function () {
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => {
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true;
          expect(body.parameters).to.deep.equal([{a: 'test'}]); // Check object parameter.
          return true;
        })
        .reply(200, {done: true, response: {result: 'Hello object'}});

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const executionResponse = await clasp.functions.runFunction('myFunction', [{a: 'test'}]);
      expect(executionResponse?.result).to.equal('Hello object');
    });
  });

  // Tests for scenarios where .clasp.json is missing, but user is authenticated.
  // This is similar to "with no local project, but authenticated".
  describe('with missing .clasp.json (invalid project), authenticated', function () {
    beforeEach(function () {
      // Mock filesystem with no .clasp.json.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        // No .clasp.json
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    afterEach(mockfs.restore);
    shouldFailFunctionOperationsWhenNotSetup();
  });
});
