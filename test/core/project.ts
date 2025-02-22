import path from 'path';
import fs from 'fs-extra';

import {fileURLToPath} from 'url';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import nock from 'nock';
import {initClaspInstance} from '../../src/core/clasp.js';

use(chaiAsPromised);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
function mockTokenRefresh() {
  nock('https://oauth2.googleapis.com').post('/token').reply(200, {
    access_token: 'mock-access-token',
    expires_in: 3599,
  });
}
*/

function mockCredentials() {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: 'mock-access-token',
  });
  return client;
}

describe('Project operations', () => {
  describe('with no project, authenticated', () => {
    beforeEach(() => {
      mockfs({});
    });

    it('should create a new script with given name', async () => {
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects/, body => {
          expect(body.title).to.equal('test script');
          expect(body.parentId).to.be.undefined;
          return true;
        })
        .reply(200, {
          scriptId: 'mock-script-id',
        });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const scriptId = await clasp.project.createScript('test script');
      expect(scriptId).to.equal('mock-script-id');
    });

    it('should create a new script with parent id', async () => {
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects/, body => {
          expect(body.title).to.equal('test script');
          expect(body.parentId).to.equal('mock-parent-id');
          return true;
        })
        .reply(200, {
          scriptId: 'mock-script-id',
          parentId: 'mock-parent-id',
        });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const scriptId = await clasp.project.createScript('test script', 'mock-parent-id');
      expect(scriptId).to.equal('mock-script-id');
    });

    it('should create a new script and container', async () => {
      nock('https://www.googleapis.com')
        .post(/drive\/v3\/files/, body => {
          expect(body.name).to.equal('test sheet');
          expect(body.mimeType).to.equal('application/vnd.google-apps.spreadsheet');
          return true;
        })
        .reply(200, {
          id: 'mock-parent-id',
        });

      nock('https://script.googleapis.com')
        .post(/\/v1\/projects/, body => {
          expect(body.title).to.equal('test sheet');
          expect(body.parentId).to.equal('mock-parent-id');
          return true;
        })
        .reply(200, {
          scriptId: 'mock-script-id',
          parentId: 'mock-parent-id',
        });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const {scriptId, parentId} = await clasp.project.createWithContainer(
        'test sheet',
        'application/vnd.google-apps.spreadsheet',
      );
      expect(scriptId).to.equal('mock-script-id');
      expect(parentId).to.equal('mock-parent-id');
    });

    it('should list available scripts', async () => {
      nock('https://www.googleapis.com')
        .get(/drive\/v3\/files/)
        .reply(200, {
          files: [
            {
              id: 'id1',
              name: 'script 1',
            },
            {
              id: 'id2',
              name: 'script 2',
            },
            {
              id: 'id3',
              name: 'script 3',
            },
          ],
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const scripts = await clasp.project.listScripts();
      expect(scripts.results.length).to.equal(3);
    });

    it('should fail to create a version', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      return expect(clasp.project.version()).to.eventually.be.rejectedWith(Error);
    });

    it('should fail to list versions', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      return expect(clasp.project.listVersions()).to.eventually.be.rejectedWith(Error);
    });

    it('should fail to list deployments', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      return expect(clasp.project.listDeployments()).to.eventually.be.rejectedWith(Error);
    });

    it('should fail to deploy', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      return expect(clasp.project.deploy()).to.eventually.be.rejectedWith(Error);
    });

    it('should fail to undeploy', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      return expect(clasp.project.undeploy('id')).to.eventually.be.rejectedWith(Error);
    });

    it('should fail to update settings', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      return expect(clasp.project.updateSettings()).to.eventually.be.rejectedWith(Error);
    });

    it('should fail to get project ID', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      expect(() => clasp.project.getProjectId()).to.throw(Error);
    });

    it('should say project does not exist', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      expect(clasp.project.exists()).to.be.false;
    });

    it('should save settings once project is set', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      clasp.withScriptId('mock-script-id');
      await clasp.project.updateSettings();

      const exists = await fs.exists('.clasp.json');
      expect(exists).to.be.true;
    });

    afterEach(() => {
      mockfs.restore();
    });
  });

  describe('with project, authenticated', () => {
    beforeEach(() => {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'ignored/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'package.json': '{}',
        'node_modules/test/index.js': '',
      });
    });

    it('should create a version', async () => {
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/.*\/versions/, body => {
          expect(body.description).to.equal('New release');
          return true;
        })
        .reply(200, {
          versionNumber: 2,
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const version = await clasp.project.version('New release');
      expect(version).to.equal(2);
    });

    it('should list versions', async () => {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/versions/)
        .reply(200, {
          versions: [
            {
              versionNumber: 1,
              description: 'lorem ipsum',
            },
            {
              versionNumber: 2,
              description: 'lorem ipsum',
            },
          ],
        });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const versions = await clasp.project.listVersions();
      expect(versions.results).to.have.length(2);
    });

    it('should list deployments', async () => {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/deployments/)
        .reply(200, {
          deployments: [
            {
              deploymentId: '123',
              deploymentConfig: {
                scriptId: 'abc',
                versionNumber: 1,
                manifestFileName: 'appsscript',
                description: 'lorem ipsum',
              },
            },
          ],
        });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const versions = await clasp.project.listDeployments();
      expect(versions.results).to.have.length(1);
    });

    it('should create new version on deploy', async () => {
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/.*\/versions/, body => {
          expect(body.description).to.equal('test');
          return true;
        })
        .reply(200, {
          versionNumber: 2,
        });
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/.*\/deployments/)
        .reply(200, {
          deploymentId: '123',
          deploymentConfig: {
            scriptId: 'abc',
            versionNumber: 2,
            manifestFileName: 'appsscript',
            description: 'lorem ipsum',
          },
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const deployment = await clasp.project.deploy('test');
      expect(deployment).to.exist;
    });

    it('should not create new version on deploy if version provided', async () => {
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/.*\/versions/, () => {
          throw new Error('Should not create new version');
        })
        .reply(200, {
          versionNumber: 2,
        });
      nock('https://script.googleapis.com')
        .post(/\/v1\/projects\/.*\/deployments/)
        .reply(200, {
          deploymentId: '123',
          deploymentConfig: {
            scriptId: 'abc',
            versionNumber: 1,
            manifestFileName: 'appsscript',
            description: 'lorem ipsum',
          },
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const deployment = await clasp.project.deploy('test', undefined, 2);
      expect(deployment).to.exist;
    });

    it('should undeploy', async () => {
      nock('https://script.googleapis.com')
        .delete(/\/v1\/projects\/.*\/deployments/)
        .reply(200, {});
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      await clasp.project.undeploy('123');
    });

    it('should update settings', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      await clasp.project.updateSettings();
    });

    it('should get project ID', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      expect(() => clasp.project.getProjectId()).to.not.throw();
    });

    it('should say project exists', async () => {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      expect(clasp.project.exists()).to.be.true;
    });

    afterEach(() => {
      mockfs.restore();
    });
  });
});
