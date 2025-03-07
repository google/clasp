import os from 'os';
import path from 'path';

import {fileURLToPath} from 'url';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import {OAuth2Client} from 'google-auth-library';
import {beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import nock from 'nock';
import {initClaspInstance} from '../../src/core/clasp.js';

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
  it('should fail to list enabled APIs', async () => {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.services.getEnabledServices()).to.eventually.be.rejectedWith(Error);
  });

  it('should fail to enable APIs', async () => {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.services.enableService('sheets')).to.eventually.be.rejectedWith(Error);
  });

  it('should fail to disable APIs', async () => {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.services.disableService('sheets')).to.eventually.be.rejectedWith(Error);
  });
}

describe('Service operations', () => {
  describe('with no project, no credentials', () => {
    beforeEach(() => {
      mockfs({});
    });
    shouldFailServiceOperationsWhenNotSetup();
  });

  describe('with no project, authenticated', () => {
    beforeEach(() => {
      mockfs({});
    });
    shouldFailServiceOperationsWhenNotSetup();
  });

  describe('with project, authenticated', () => {
    beforeEach(() => {
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

    it('should  list available APIs', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const services = await clasp.services.getAvailableServices();
      expect(services).to.containSubset([{name: 'docs'}]);
    });

    it('should list enabled APIs', async () => {
      nock('https://serviceusage.googleapis.com')
        .get(/v1\/(.*)\/services/)
        .reply(200, {
          services: [
            {
              name: '123',
              config: {
                name: 'docs.googleapis.com',
              },
              state: 'ENABLED',
            },
          ],
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const services = await clasp.services.getEnabledServices();
      expect(services).to.containSubset([{name: 'docs'}]);
    });

    it('should enable an api in manifest', async () => {
      nock('https://serviceusage.googleapis.com')
        .post(/v1\/(.*)\/services\/(.*):enable/)
        .reply(200, {});
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      await clasp.services.enableService('docs');
      const manifest = await clasp.project.readManifest();
      expect(manifest.dependencies?.enabledAdvancedServices).to.containSubset([{serviceId: 'docs'}]);
    });

    it('should disable an api in manifest', async () => {
      nock('https://serviceusage.googleapis.com')
        .post(/v1\/(.*)\/services\/(.*):disable/)
        .reply(200, {});
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      await clasp.services.disableService('gmail');
      const manifest = await clasp.project.readManifest();
      expect(manifest.dependencies?.enabledAdvancedServices).to.not.containSubset([{serviceId: 'gmail'}]);
    });
  });

});

