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

// This file contains tests for the core log management functionalities.

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

function shouldFailLogOperationsWhenNotSetup() {
  it('should fail to get log entries', async function () {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.logs.getLogEntries()).to.eventually.be.rejectedWith(Error);
  });
}

describe('Log operations', function () {
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
    shouldFailLogOperationsWhenNotSetup();
    afterEach(mockfs.restore);
  });

  describe('with no project, authenticated', function () {
    beforeEach(function () {
      mockfs({});
    });
    shouldFailLogOperationsWhenNotSetup();
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
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    afterEach(mockfs.restore);

    it('should get log entries', async function () {
      nock('https://logging.googleapis.com')
        .post(/\/v2\/entries:list/, body => {
          expect(body.resourceNames).to.eql(['projects/mock-gcp-project']);
          expect(body.filter).to.equal('');
          expect(body.orderBy).to.equal('timestamp desc');
          expect(body.pageSize).to.equal(100);
          return true;
        })
        .reply(200, {
          entries: [
            {
              timestamp: '2023-10-27T10:00:00Z',
              logName: 'projects/my-gcp-project/logs/stdout',
              severity: 'INFO',
            },
          ],
          nextPageToken: undefined,
        });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const logs = await clasp.logs.getLogEntries();
      expect(logs.results.length).to.equal(1);
      expect(logs.results[0].logName).to.eql('projects/my-gcp-project/logs/stdout');
    });

    it('should get log entries since', async function () {
      const since = new Date('2023-10-26T10:00:00Z');
      nock('https://logging.googleapis.com')
        .post(/\/v2\/entries:list/, body => {
          expect(body.resourceNames).to.eql(['projects/mock-gcp-project']);
          expect(body.filter).to.equal('timestamp >= "2023-10-26T10:00:00.000Z"');
          expect(body.orderBy).to.equal('timestamp desc');
          expect(body.pageSize).to.equal(100);
          return true;
        })
        .reply(200, {
          entries: [
            {
              timestamp: '2023-10-27T10:00:00Z',
              logName: 'projects/my-gcp-project/logs/stdout',
              severity: 'INFO',
            },
          ],
          nextPageToken: undefined,
        });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const logs = await clasp.logs.getLogEntries(since);
      expect(logs.results.length).to.equal(1);
      expect(logs.results[0].logName).to.eql('projects/my-gcp-project/logs/stdout');
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
    shouldFailLogOperationsWhenNotSetup();
  });
});
