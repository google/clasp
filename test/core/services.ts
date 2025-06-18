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

// This file contains tests for the core service management functionalities.

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
const __dirname = path.dirname(__filename);

function mockCredentials() {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: 'mock-access-token',
  });
  return client;
}

function shouldFailServiceOperationsWhenNotSetup() {
  it('should fail to list enabled APIs', async function () {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.services.getEnabledServices()).to.eventually.be.rejectedWith(Error);
  });

  it('should fail to enable APIs', async function () {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.services.enableService('sheets')).to.eventually.be.rejectedWith(Error);
  });

  it('should fail to disable APIs', async function () {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.services.disableService('sheets')).to.eventually.be.rejectedWith(Error);
  });
}

describe('Service operations', function () {
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
    shouldFailServiceOperationsWhenNotSetup();
  });

  describe('with no project, authenticated', function () {
    beforeEach(function () {
      mockfs({});
    });
    shouldFailServiceOperationsWhenNotSetup();
  });

  describe('with project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-services.json')),
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

    it('should  list available APIs', async function () {
      mockListApis();
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const services = await clasp.services.getAvailableServices();
      expect(services).to.containSubset([{name: 'docs'}]);
    });

    it('should list enabled APIs', async function () {
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const services = await clasp.services.getEnabledServices();
      expect(services).to.containSubset([{name: 'docs'}]);
    });

    it('should enable an api in manifest', async function () {
      mockEnableService({
        projectId: 'mock-gcp-project',
        serviceName: 'docs.googleapis.com',
      });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      await clasp.services.enableService('docs');
      const manifest = await clasp.project.readManifest();
      expect(manifest.dependencies?.enabledAdvancedServices).to.containSubset([{serviceId: 'docs'}]);
    });

    it('should disable an api in manifest', async function () {
      mockDisableService({
        projectId: 'mock-gcp-project',
        serviceName: 'gmail.googleapis.com',
      });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      await clasp.services.disableService('gmail');
      const manifest = await clasp.project.readManifest();
      expect(manifest.dependencies?.enabledAdvancedServices).to.not.containSubset([{serviceId: 'gmail'}]);
    });
  });
});
