import os from 'os';
import path from 'path';

import {fileURLToPath} from 'url';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import nock from 'nock';
import {initClaspInstance} from '../../src/core/clasp.js';
import {resetMocks, setupMocks} from '../mocks.js';
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

describe('File operations', function () {
  beforeEach(function () {
    setupMocks();
  });

  afterEach(function () {
    resetMocks();
  });

  describe('with valid project, no ignore file', function () {
    beforeEach(function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'ignored/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'package.json': '{}',
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should collect local files non-recursively with default ignore', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(3);
    });

    it('should push files', async function () {
      nock('https://script.googleapis.com')
        .put(/\/v1\/projects\/.*\/content/, body => {
          expect(body.files).to.have.length(3);
          expect(body.files[0].name).to.equal('appsscript');
          expect(body.files[0].type).to.equal('JSON');
          expect(body.files[0].source).to.have.lengthOf.above(1);
          expect(body.files[1].name).to.equal('Code');
          expect(body.files[1].type).to.equal('SERVER_JS');
          expect(body.files[1].source).to.have.lengthOf.above(1);
          expect(body.files[2].name).to.equal('page');
          expect(body.files[2].type).to.equal('HTML');
          expect(body.files[2].source).to.have.lengthOf.above(1);
          return true;
        })
        .reply(200, {});
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pushedFiles = await clasp.files.push();
      expect(pushedFiles).to.have.length(3);
    });

    it('should fetch remote files', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'appsscript',
              type: 'JSON',
              source: '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
            },
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function helloWorld() {\n  console.log("Hello, world!");\n}',
            },
          ],
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pulledFiles = await clasp.files.fetchRemote();
      expect(pulledFiles).to.have.length(2);
      expect(pulledFiles[0].localPath).to.equal('appsscript.json');
      expect(pulledFiles[1].localPath).to.equal('Code.js');
    });

    it('should fetch remote files with version #', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .query({versionNumber: 2})
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'appsscript',
              type: 'JSON',
              source: '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
            },
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function helloWorld() {\n  console.log("Hello, world!");\n}',
            },
          ],
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pulledFiles = await clasp.files.fetchRemote(2);
      expect(pulledFiles).to.have.length(2);
      expect(pulledFiles[0].localPath).to.equal('appsscript.json');
      expect(pulledFiles[1].localPath).to.equal('Code.js');
    });

    it('should pull files', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'appsscript',
              type: 'JSON',
              source: '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
            },
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function helloWorld() {\n  console.log("Hello, world!");\n}',
            },
          ],
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pulledFiles = await clasp.files.pull();
      expect(pulledFiles).to.have.length(2);
      expect(pulledFiles[0].localPath).to.equal('appsscript.json');
      expect(pulledFiles[1].localPath).to.equal('Code.js');
    });

    it('should pull files with version #', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .query({versionNumber: 2})
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'appsscript',
              type: 'JSON',
              source: '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
            },
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function helloWorld() {\n  console.log("Hello, world!");\n}',
            },
          ],
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pulledFiles = await clasp.files.pull(2);
      expect(pulledFiles).to.have.length(2);
      expect(pulledFiles[0].localPath).to.equal('appsscript.json');
      expect(pulledFiles[1].localPath).to.equal('Code.js');
    });

    afterEach(function () {
      mockfs.restore();
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

    it('should not collect local files', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      expect(clasp.files.collectLocalFiles()).to.eventually.be.rejectedWith(Error);
    });

    it('should not push files', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      expect(clasp.files.push()).to.eventually.be.rejectedWith(Error);
    });

    it('should not fetch remote files', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      expect(clasp.files.fetchRemote()).to.eventually.be.rejectedWith(Error);
    });

    it('should not pull files', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      expect(clasp.files.pull()).to.eventually.be.rejectedWith(Error);
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  describe('with valid project, unauthenticated', function () {
    beforeEach(function () {
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

    it('should collect local files non-recursively with default ignore', async function () {
      const clasp = await initClaspInstance({});
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(3);
    });

    it('should not push files', async function () {
      const clasp = await initClaspInstance({});
      expect(clasp.files.push()).to.eventually.be.rejectedWith(Error);
    });

    it('should not fetch remote files', async function () {
      const clasp = await initClaspInstance({});
      expect(clasp.files.fetchRemote()).to.eventually.be.rejectedWith(Error);
    });

    it('should not pull files', async function () {
      const clasp = await initClaspInstance({});
      expect(clasp.files.pull()).to.eventually.be.rejectedWith(Error);
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  describe('with valid project, root directory, no ignore file', function () {
    beforeEach(function () {
      mockfs({
        'dist/appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'dist/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'dist/ignored/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'dist/page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-dist.json')),
        'package.json': '{}',
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should collect local files from src dir, non recursively and with default ignore', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(3);
    });

    it('should push files with flat names', async function () {
      nock('https://script.googleapis.com')
        .put(/\/v1\/projects\/.*\/content/, body => {
          expect(body.files).to.have.length(3);
          expect(body.files[0].name).to.equal('appsscript');
          expect(body.files[0].type).to.equal('JSON');
          expect(body.files[0].source).to.have.lengthOf.above(1);
          expect(body.files[1].name).to.equal('Code');
          expect(body.files[1].type).to.equal('SERVER_JS');
          expect(body.files[1].source).to.have.lengthOf.above(1);
          expect(body.files[2].name).to.equal('page');
          expect(body.files[2].type).to.equal('HTML');
          expect(body.files[2].source).to.have.lengthOf.above(1);
          return true;
        })
        .reply(200, {});
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pushedFiles = await clasp.files.push();
      expect(pushedFiles).to.have.length(3);
    });

    it('should pull files into src directory', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'appsscript',
              type: 'JSON',
              source: '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
            },
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function helloWorld() {\n  console.log("Hello, world!");\n}',
            },
          ],
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pulledFiles = await clasp.files.pull();
      expect(pulledFiles).to.have.length(2);
      expect(pulledFiles[0].localPath).to.equal('dist/appsscript.json');
      expect(pulledFiles[1].localPath).to.equal('dist/Code.js');
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  describe('with valid project, root directory, ignore file', function () {
    beforeEach(function () {
      mockfs({
        '.claspignore': mockfs.load(path.resolve(__dirname, '../fixtures/dot-claspignore.txt')),
        'dist/appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'dist/src/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'dist/view/page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-dist.json')),
        'package.json': '{}',
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should collect local files recursively', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(3);
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  describe('with valid project, ignore file', function () {
    beforeEach(function () {
      mockfs({
        '.claspignore': mockfs.load(path.resolve(__dirname, '../fixtures/dot-claspignore.txt')),
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'src/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'src/page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        'src/readme.md': '',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'package.json': '{}',
        'node_modules/test/file1.js': '',
        'node_modules/test/file2.js': '',
        'node_modules/test2/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should collect local files recursively', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(3);
    });

    it('should get untracked files', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.getUntrackedFiles();
      expect(foundFiles).to.have.length(5);
    });

    it('should collapse untracked files to common roots', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.getUntrackedFiles();
      expect(foundFiles).to.include('node_modules/');
      expect(foundFiles).to.not.include('node_modules/test/');
      expect(foundFiles).to.not.include('node_modules/test/file1.js');
      expect(foundFiles).to.include('src/readme.md');
    });
  });

  describe('with project with extensions set', function () {
    beforeEach(function () {
      mockfs({
        '.claspignore': mockfs.load(path.resolve(__dirname, '../fixtures/dot-claspignore.txt')),
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'OtherCode.ts': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'Ignored.gs': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.htmlx': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        'ignored.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-extensions.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should collect only files matching extensions', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(4);
      expect(foundFiles).to.not.contain('ignored.html');
      expect(foundFiles).to.not.contain('Ignored.gs');
    });

    it('should get untracked files', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.getUntrackedFiles();
      expect(foundFiles).to.contain('ignored.html');
      expect(foundFiles).to.contain('Ignored.gs');
    });

    it('should use first extension when saving.', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'appsscript',
              type: 'JSON',
              source: '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
            },
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function helloWorld() {\n  console.log("Hello, world!");\n}',
            },
            {
              name: 'Page',
              type: 'HTML',
              source: '<html/>',
            },
          ],
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pulledFiles = await clasp.files.pull();
      expect(pulledFiles).to.have.length(3);
      expect(pulledFiles[0].localPath).to.equal('appsscript.json');
      expect(pulledFiles[1].localPath).to.equal('Code.ts');
      expect(pulledFiles[2].localPath).to.equal('Page.htmlx');
    });

  });

});
