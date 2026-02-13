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

// This file contains tests for the core file management functionalities.

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

describe('File operations', function () {
  beforeEach(function () {
    setupMocks();
  });

  afterEach(function () {
    resetMocks();
  });

  // Test suite for file operations under ideal conditions: a valid project configuration exists,
  // the user is authenticated, and no .claspignore file is present (so default ignores apply).
  describe('with valid project, no ignore file', function () {
    beforeEach(function () {
      // Mock a typical project setup.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'subdir/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'package.json': '{}',
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should collect local files recursively with default ignore', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(4);
    });

    it('should push files', async function () {
      nock('https://script.googleapis.com')
        .put(/\/v1\/projects\/.*\/content/, body => {
          expect(body.files).to.containSubset([
            {
              name: 'appsscript',
            },
          ]);
          expect(body.files).to.containSubset([
            {
              name: 'Code',
            },
          ]);
          expect(body.files).to.containSubset([
            {
              name: 'subdir/Code',
            },
          ]);
          expect(body.files).to.containSubset([
            {
              name: 'page',
            },
          ]);
          return true;
        })
        .reply(200, {});
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pushedFiles = await clasp.files.push();
      expect(pushedFiles).to.have.length(4);
    });

    // Verifies that `fetchRemote` correctly retrieves and maps files from the API.
    it('should fetch remote files', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/) // Mocks the GetContent call.
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
      mockfs.restore(); // Clean up mock filesystem.
    });
  });

  // Test suite for projects where `skipSubdirectories` is enabled in .clasp.json.
  describe('with valid project, skipSubdirectories enabled', function () {
    beforeEach(function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'subdir/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': JSON.stringify(
          {
            scriptId: 'mock-script-id',
            skipSubdirectories: true,
          },
          null,
          2,
        ),
        'package.json': '{}',
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should not collect files from subdirectories', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      const foundFilePaths = foundFiles.map(file => file.localPath);

      expect(foundFilePaths).to.not.include(path.normalize('subdir/Code.js'));
      expect(foundFiles).to.have.length(3);
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  describe('with conflicting local server file names', function () {
    afterEach(function () {
      mockfs.restore();
    });

    it('should reject files with same basename in same directory', async function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'Code.gs': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      try {
        await clasp.files.collectLocalFiles();
        expect.fail('Expected collectLocalFiles to fail for conflicting filenames');
      } catch (error) {
        const err = error as Error & {cause?: {code?: string; value?: string}};
        expect(err.cause?.code).to.equal('FILE_CONFLICT');
        expect(err.cause?.value).to.equal('Code');
      }
    });

    it('should allow same basename in different directories', async function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'subdir/Code.gs': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();

      expect(foundFiles).to.have.length(3);
      expect(foundFiles.map(file => file.remotePath)).to.contain('Code');
      expect(foundFiles.map(file => file.remotePath)).to.contain('subdir/Code');
    });
  });

  // Test suite for scenarios where the local project setup is invalid (e.g., missing .clasp.json),
  // even if the user is authenticated. Most operations should fail.
  describe('with invalid project, authenticated', function () {
    beforeEach(function () {
      // Mock a filesystem that lacks a .clasp.json, representing an uninitialized or misconfigured project.
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

  // Test suite for scenarios where a valid local project exists (.clasp.json is present)
  // but the user is not authenticated (no .clasprc.json).
  describe('with valid project, unauthenticated', function () {
    beforeEach(function () {
      // Mock a filesystem with project config but no global auth file.
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

    it('should collect local files recursively with default ignore', async function () {
      const clasp = await initClaspInstance({});
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(4);
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

  // Test suite for projects where the 'rootDir' in .clasp.json specifies a subdirectory
  // for source files, and no .claspignore file is present.
  describe('with valid project, root directory, no ignore file', function () {
    beforeEach(function () {
      // .clasp.json in this fixture points 'rootDir' to 'dist/'.
      mockfs({
        'dist/appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'dist/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'dist/subdir/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'dist/page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-dist.json')),
        'package.json': '{}',
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should collect local files from src dir, recursively and with default ignore', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(4);
    });

    it('should push files with flat names', async function () {
      nock('https://script.googleapis.com')
        .put(/\/v1\/projects\/.*\/content/, body => {
          expect(body.files).to.containSubset([
            {
              name: 'appsscript',
            },
          ]);
          expect(body.files).to.containSubset([
            {
              name: 'Code',
            },
          ]);
          expect(body.files).to.containSubset([
            {
              name: 'subdir/Code',
            },
          ]);
          expect(body.files).to.containSubset([
            {
              name: 'page',
            },
          ]);
          return true;
        })
        .reply(200, {});
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pushedFiles = await clasp.files.push();
      expect(pushedFiles).to.have.length(4);
    });

    // Verifies that `pull` correctly places files into the specified 'rootDir' (e.g., 'dist/').
    it('should pull files into src directory', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/) // Mocks the GetContent API call.
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
      expect(pulledFiles[0].localPath).to.equal(path.normalize('dist/appsscript.json'));
      expect(pulledFiles[1].localPath).to.equal(path.normalize('dist/Code.js'));
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  // Test suite for projects with a 'rootDir' specified in .clasp.json and an active .claspignore file.
  describe('with valid project, root directory, ignore file', function () {
    beforeEach(function () {
      // .clasp.json points to 'dist/', and .claspignore has specific rules.
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

  // Test suite for projects with a .claspignore file but no 'rootDir' (source files at project root).
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

    // This test checks the logic in `getUntrackedFiles` that groups multiple untracked files
    // under their closest common parent directory if that parent itself isn't part of the project.
    it('should collapse untracked files to common roots', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.getUntrackedFiles();
      expect(foundFiles).to.include(path.normalize('node_modules/')); // node_modules itself is untracked.
      // Individual files or subdirectories within an already reported untracked root should not be listed.
      expect(foundFiles).to.not.include(path.normalize('node_modules/test/'));
      expect(foundFiles).to.not.include(path.normalize('node_modules/test/file1.js'));
      expect(foundFiles).to.include(path.normalize('src/readme.md')); // Individual untracked file.
    });
  });

  // Test suite for projects where `.clasp.json` specifies custom `fileExtensions`
  // for different Apps Script file types (SERVER_JS, HTML).
  describe('with project with extensions set', function () {
    beforeEach(function () {
      // .clasp.json in this fixture defines custom extensions like .ts for SERVER_JS
      // and .htmlx for HTML.
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
      expect(pulledFiles[2].localPath).to.equal('Page.htmlx'); // HTML file should use .htmlx.
    });
  });

  // Test suite to ensure that an empty .claspignore file behaves as if no ignore file was present
  // (i.e., only default ignores apply).
  describe('with valid project, empty ignore file', function () {
    beforeEach(function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'subdir/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        '.claspignore': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should collect local files', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(4);
    });
  });
});
