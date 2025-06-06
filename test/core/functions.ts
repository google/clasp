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

// This file contains tests for the core function management functionalities.

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
const __dirname = path.dirname(__filename);

function mockCredentials() {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: 'mock-access-token',
  });
  return client;
}

function shouldFailFunctionOperationsWhenNotSetup() {
  it('should fail to run a function', async function () {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.functions.runFunction('myFunction', [])).to.eventually.be.rejectedWith(Error);
  });
  it('should fail to run a function with string argument', async function () {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.functions.runFunction('myFunction', ['test'])).to.eventually.be.rejectedWith(Error);
  });
  it('should fail to run a function with object argument', async function () {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.functions.runFunction('myFunction', [{a: 'test'}])).to.eventually.be.rejectedWith(Error);
  });
}

describe('Function operations', function () {
  beforeEach(function () {
    setupMocks();
  });

  afterEach(function () {
    resetMocks();
  });

  describe('with no project, no credentials', function () {
    beforeEach(function () {
      mockfs({});
    });
    shouldFailFunctionOperationsWhenNotSetup();
    afterEach(mockfs.restore);
  });

  describe('with no project, authenticated', function () {
    beforeEach(function () {
      mockfs({});
    });
    shouldFailFunctionOperationsWhenNotSetup();
    afterEach(mockfs.restore);
  });

  describe('with project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'ignored/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        'package.json': '{}',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    afterEach(mockfs.restore);

    it('should run a function', async function () {
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => {
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true;
          return true;
        })
        .reply(200, {
          done: true,
          response: {
            result: 'Hello',
          },
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const res = await clasp.functions.runFunction('myFunction', []);
      expect(res.response?.result).to.equal('Hello');
    });
    it('should run a function with string argument', async function () {
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => {
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true;
          expect(body.parameters).to.deep.equal(['test']);
          return true;
        })
        .reply(200, {
          done: true,
          response: {
            result: 'Hello',
          },
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const res = await clasp.functions.runFunction('myFunction', ['test']);
      expect(res.response?.result).to.equal('Hello');
    });

    it('should run a function with object argument', async function () {
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => {
          nock('https://script.googleapis.com');
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true;
          expect(body.parameters).to.deep.equal([{a: 'test'}]);
          return true;
        })
        .reply(200, {
          done: true,
          response: {
            result: 'Hello',
          },
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const res = await clasp.functions.runFunction('myFunction', [{a: 'test'}]);
      expect(res.response?.result).to.equal('Hello');
    });
  });

  describe('with invalid project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'ignored/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        'package.json': '{}',
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    afterEach(mockfs.restore);
    shouldFailFunctionOperationsWhenNotSetup();
  });
});
