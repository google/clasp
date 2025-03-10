import os from 'os';
import path from 'path';

import {fileURLToPath} from 'url';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {initClaspInstance} from '../../src/core/clasp.js';
import {mockDisableService, mockEnableService, mockListApis, mockListEnabledServices, resetMocks, setupMocks} from '../mocks.js';
use(chaiSubset);
use(chaiAsPromised);

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
