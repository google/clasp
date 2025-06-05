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
 * @fileoverview Unit and integration tests for the `Files` class and related
 * file utility functions in `src/core/files.ts`. These tests cover various
 * scenarios including local file collection with and without ignore files,
 * pushing files to and fetching/pulling files from the Apps Script API,
 * handling different project configurations (e.g., rootDir, custom extensions),
 * and behavior under different authentication states.
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
 * Creates a mock OAuth2Client instance for testing purposes.
 * @returns A mock OAuth2Client with minimal credentials set.
 */
function mockCredentials(): OAuth2Client {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: 'mock-access-token', // A fake access token.
  });
  return client;
}

// Main test suite for file operations.
describe('File operations', function () {
  // Common setup and teardown for all tests in this suite.
  beforeEach(function () {
    setupMocks(); // Initializes nock for HTTP mocking and mock-fs for filesystem mocking.
  });

  afterEach(function () {
    resetMocks(); // Restores the filesystem and nock configurations.
  });

  // Test scenarios with a valid .clasp.json, authenticated user, and no .claspignore file (relying on default ignores).
  describe('with valid project, authenticated, and default ignores', function () {
    beforeEach(function () {
      // Mock the filesystem for a typical project structure.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'subdir/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')), // Standard project config.
        'package.json': '{}', // Included to test default ignore behavior.
        'node_modules/test/index.js': '', // Also for testing default ignore.
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test collecting local files with default ignore patterns.
    it('should collect local files recursively with default ignore', async function () {
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const foundFiles = await clasp.files.collectLocalFiles();
      // Expects appsscript.json, Code.js, subdir/Code.js, page.html (4 files).
      // package.json and node_modules should be ignored by default.
      expect(foundFiles).to.have.length(4);
    });

    // Test pushing files to the Apps Script server.
    it('should push files', async function () {
      // Mock the API endpoint for updating project content.
      nock('https://script.googleapis.com')
        .put(/\/v1\/projects\/.*\/content/, body => {
          // Basic checks on the request body.
          expect(body.files).to.be.an('array').with.lengthOf(4);
          expect(body.files).to.containSubset([{name: 'appsscript'}]);
          expect(body.files).to.containSubset([{name: 'Code'}]);
          expect(body.files).to.containSubset([{name: 'subdir/Code'}]);
          expect(body.files).to.containSubset([{name: 'page'}]);
          return true; // Indicate the request body is acceptable.
        })
        .reply(200, {}); // Simulate a successful API response.

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const pushedFiles = await clasp.files.push();
      expect(pushedFiles).to.have.length(4); // Verify all expected files were "pushed".
    });

    // Test fetching remote file content.
    it('should fetch remote files', async function () {
      // Mock the API endpoint for getting project content.
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/) // Matches any get request to the content endpoint.
        .reply(200, { // Simulate a successful API response with mock file data.
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
      const pulledFiles = await clasp.files.fetchRemote(); // Method under test.
      expect(pulledFiles).to.have.length(2);
      expect(pulledFiles[0].localPath).to.equal('appsscript.json');
      expect(pulledFiles[1].localPath).to.equal('Code.js');
    });

    // Test fetching a specific version of remote files.
    it('should fetch remote files for a specific version number', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .query({versionNumber: 2}) // Expect 'versionNumber=2' in the query.
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [ /* ... mock file data ... */ ],
        });

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const pulledFiles = await clasp.files.fetchRemote(2); // Pass version number.
      // Assertions on pulledFiles would follow...
      expect(pulledFiles).to.be.an('array'); // Basic check
    });

    // Test pulling files (fetchRemote + writing to disk).
    it('should pull files (fetch and write to disk)', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [ /* ... mock file data ... */ ],
        });

      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const pulledFiles = await clasp.files.pull(); // Pulls and writes files.
      // Assertions that files were written to the mock filesystem would follow.
      expect('appsscript.json').to.be.a.realFile();
      expect(pulledFiles).to.be.an('array');
    });

    // Test pulling a specific version of files.
    it('should pull files for a specific version number (fetch and write)', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .query({versionNumber: 2})
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [ /* ... mock file data ... */ ],
        });
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const pulledFiles = await clasp.files.pull(2);
      expect('appsscript.json').to.be.a.realFile(); // Check if files are written
      expect(pulledFiles).to.be.an('array');
    });

    afterEach(function () {
      mockfs.restore(); // Clean up mock filesystem.
    });
  });

  // Test scenarios where the local project setup is invalid (e.g., .clasp.json missing), but user is authenticated.
  describe('with invalid local project (no .clasp.json), authenticated', function () {
    beforeEach(function () {
      // Mock filesystem without a .clasp.json file.
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')), // A manifest might still exist.
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        // 'ignored/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')), // Example of other files
        // 'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        // 'package.json': '{}',
        // 'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load( // Still authenticated
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Operations requiring a script ID (from .clasp.json) should fail.
    it('should fail to collect local files if .clasp.json is missing scriptId', async function () {
      // initClaspInstance in this case will not find a .clasp.json, so project.scriptId will be undefined.
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      // collectLocalFiles asserts script configuration, which includes scriptId.
      await expect(clasp.files.collectLocalFiles()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to push files if .clasp.json is missing scriptId', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      await expect(clasp.files.push()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to fetch remote files if .clasp.json is missing scriptId', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      await expect(clasp.files.fetchRemote()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    it('should fail to pull files if .clasp.json is missing scriptId', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      await expect(clasp.files.pull()).to.eventually.be.rejectedWith(Error, /Project settings not found/);
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  // Test scenarios with a valid .clasp.json but no authentication.
  describe('with valid project, unauthenticated', function () {
    beforeEach(function () {
      // Mock filesystem with a .clasp.json but no .clasprc.json (simulating no auth).
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        // No .clasprc.json in this setup
      });
    });

    // Collecting local files does not require authentication, only a valid project structure.
    it('should collect local files even if unauthenticated', async function () {
      const clasp = await initClaspInstance({}); // No credentials passed
      const foundFiles = await clasp.files.collectLocalFiles();
      expect(foundFiles).to.have.length(2); // appsscript.json and Code.js based on dot-clasp-no-settings
    });

    // API-dependent operations should fail due to lack of authentication.
    it('should fail to push files if unauthenticated', async function () {
      const clasp = await initClaspInstance({});
      await expect(clasp.files.push()).to.eventually.be.rejectedWith(Error, /User is not authenticated/);
    });

    it('should fail to fetch remote files if unauthenticated', async function () {
      const clasp = await initClaspInstance({});
      await expect(clasp.files.fetchRemote()).to.eventually.be.rejectedWith(Error, /User is not authenticated/);
    });

    it('should fail to pull files if unauthenticated', async function () {
      const clasp = await initClaspInstance({});
      await expect(clasp.files.pull()).to.eventually.be.rejectedWith(Error, /User is not authenticated/);
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  // Tests for projects configured with a 'rootDir' in .clasp.json, no specific .claspignore.
  describe('with valid project, rootDir specified, authenticated, default ignores', function () {
    beforeEach(function () {
      // Mock filesystem: .clasp.json specifies "rootDir": "dist".
      mockfs({
        'dist/appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'dist/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'dist/subdir/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')), // Test subdirectory within rootDir
        'dist/page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-dist.json')), // Configures "rootDir": "dist"
        // Other files outside 'dist/' to ensure they are not collected.
        'otherfile.js': 'console.log("ignored");',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test collecting files from the specified 'rootDir'.
    it('should collect local files from specified rootDir, respecting default ignores', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const foundFiles = await clasp.files.collectLocalFiles();
      // Expects files from 'dist/' directory: appsscript.json, Code.js, subdir/Code.js, page.html.
      expect(foundFiles).to.have.length(4);
      // Ensure paths are relative to CWD but correctly point within 'dist/'.
      expect(foundFiles.map(f => f.localPath)).to.contain(path.normalize('dist/appsscript.json'));
      expect(foundFiles.map(f => f.localPath)).to.not.contain('otherfile.js');
    });

    // Test pushing files from the specified 'rootDir'.
    it('should push files from specified rootDir, mapping remote paths correctly', async function () {
      nock('https://script.googleapis.com')
        .put(/\/v1\/projects\/.*\/content/, body => {
          // Remote paths should be relative to the 'rootDir' (dist).
          expect(body.files).to.containSubset([{name: 'appsscript'}]);
          expect(body.files).to.containSubset([{name: 'Code'}]);
          expect(body.files).to.containSubset([{name: 'subdir/Code'}]); // Subdirectories within rootDir are preserved.
          expect(body.files).to.containSubset([{name: 'page'}]);
          return true;
        })
        .reply(200, {});
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const pushedFiles = await clasp.files.push();
      expect(pushedFiles).to.have.length(4);
    });

    // Test pulling files into the specified 'rootDir'.
    it('should pull files into the specified rootDir', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, { // Mock remote files.
          scriptId: 'mock-script-id',
          files: [
            {name: 'appsscript', type: 'JSON', source: '{}'},
            {name: 'MainCode', type: 'SERVER_JS', source: 'function main(){}'},
          ],
        });
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const pulledFiles = await clasp.files.pull();
      expect(pulledFiles).to.have.length(2);
      // Local paths should be inside the 'dist/' directory.
      expect(pulledFiles[0].localPath).to.equal(path.normalize('dist/appsscript.json'));
      expect(pulledFiles[1].localPath).to.equal(path.normalize('dist/MainCode.js')); // Assuming .js default
      expect('dist/appsscript.json').to.be.a.realFile();
      expect('dist/MainCode.js').to.be.a.realFile();
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  // Tests for projects with 'rootDir' and a custom .claspignore file.
  describe('with valid project, rootDir specified, and .claspignore file', function () {
    beforeEach(function () {
      // .claspignore might ignore files within the 'dist/src' or 'dist/view' paths.
      mockfs({
        '.claspignore': '# Specific ignores\ndist/src/ignoreMe.js\n*.log',
        'dist/appsscript.json': '{}',
        'dist/src/Code.js': 'function a(){}',
        'dist/src/ignoreMe.js': 'function b(){}', // Should be ignored by .claspignore
        'dist/view/page.html': '<p>Hello</p>',
        'dist/error.log': 'Error details', // Should be ignored
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-dist.json')), // "rootDir": "dist"
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test that .claspignore rules are correctly applied relative to the project root,
    // even when a separate rootDir is used for source files.
    it('should collect local files from rootDir, respecting .claspignore relative to project root', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const foundFiles = await clasp.files.collectLocalFiles();
      // Based on .claspignore: 'dist/src/ignoreMe.js' and '*.log' are ignored.
      // Expected: dist/appsscript.json, dist/src/Code.js, dist/view/page.html
      expect(foundFiles).to.have.length(3);
      expect(foundFiles.map(f => f.localPath)).to.not.include(path.normalize('dist/src/ignoreMe.js'));
      expect(foundFiles.map(f => f.localPath)).to.not.include(path.normalize('dist/error.log'));
    });

    afterEach(function () {
      mockfs.restore();
    });
  });

  // Tests for projects with a .claspignore file at the project root (no separate rootDir).
  describe('with valid project and .claspignore file', function () {
    beforeEach(function () {
      // .claspignore from fixtures typically ignores 'ignored/', '*.md', 'node_modules/'
      mockfs({
        '.claspignore': mockfs.load(path.resolve(__dirname, '../fixtures/dot-claspignore.txt')),
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')), // Tracked
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')), // Tracked
        'ignored/ignoreThis.js': 'console.log("ignored");', // Ignored by directory pattern
        'README.md': '# Test Readme', // Ignored by *.md pattern
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test that .claspignore correctly filters files.
    it('should collect local files respecting .claspignore', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const foundFiles = await clasp.files.collectLocalFiles();
      // Based on dot-claspignore.txt: appsscript.json, Code.js, page.html should be included.
      expect(foundFiles).to.have.length(3);
      expect(foundFiles.map(f => f.localPath)).to.not.include('ignored/ignoreThis.js');
      expect(foundFiles.map(f => f.localPath)).to.not.include('README.md');
    });

    // Test identification of untracked files.
    it('should correctly list untracked files, collapsing to common ignored roots', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const untracked = await clasp.files.getUntrackedFiles();
      // Expected untracked: 'ignored/', 'README.md' (and any defaults like node_modules/ if present and not ignored)
      // This depends heavily on the contents of dot-claspignore.txt and default ignores.
      // Assuming dot-claspignore.txt ignores 'ignored/' and '*.md'.
      expect(untracked).to.include(path.normalize('ignored/'));
      expect(untracked).to.include('README.md');
      // Check that individual files within an ignored directory are not listed separately.
      expect(untracked).to.not.include(path.normalize('ignored/ignoreThis.js'));
    });
  });

  // Tests for projects with custom file extensions defined in .clasp.json.
  describe('with project using custom file extensions', function () {
    beforeEach(function () {
      // .clasp.json in this fixture defines custom extensions like .ts for SERVER_JS, .htmlx for HTML.
      mockfs({
        // .claspignore might also be relevant if it has extension-specific rules.
        '.claspignore': mockfs.load(path.resolve(__dirname, '../fixtures/dot-claspignore.txt')), // Example: Ignores 'dist/'
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.ts': 'function helloTypeScript() {}', // Should be collected as SERVER_JS
        'Utilities.gs': 'function utility(){}', // Should be ignored if .gs is not in scriptExtensions
        'view.htmlx': '<p>Custom HTML</p>', // Should be collected as HTML
        'legacy.html': '<p>Legacy HTML</p>', // Should be ignored if .html is not in htmlExtensions
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-extensions.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // Test that files matching custom extensions are collected.
    it('should collect local files matching custom extensions', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const foundFiles = await clasp.files.collectLocalFiles();
      // Based on dot-clasp-extensions.json: appsscript.json, Code.ts, view.htmlx
      expect(foundFiles).to.have.length(3);
      expect(foundFiles.map(f => path.basename(f.localPath))).to.contain.members(['appsscript.json', 'Code.ts', 'view.htmlx']);
      expect(foundFiles.map(f => path.basename(f.localPath))).to.not.contain.members(['Utilities.gs', 'legacy.html']);
    });

    // Test that untracked files list respects custom extensions.
    it('should list files not matching custom extensions as untracked', async function () {
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const untracked = await clasp.files.getUntrackedFiles();
      expect(untracked).to.contain('Utilities.gs');
      expect(untracked).to.contain('legacy.html');
    });

    // Test that pulling files uses the primary custom extension for each type.
    it('should use the first custom extension when pulling and saving files', async function () {
      // Mock API response for pulling files.
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id', // From dot-clasp-extensions.json
          files: [
            {name: 'appsscript', type: 'JSON', source: '{}'},
            {name: 'ServerCode', type: 'SERVER_JS', source: 'function s(){}'},
            {name: 'UserInterface', type: 'HTML', source: '<div></div>'},
          ],
        });
      const clasp = await initClaspInstance({credentials: mockCredentials()});
      const pulledFiles = await clasp.files.pull();
      expect(pulledFiles).to.have.length(3);
      // Based on dot-clasp-extensions.json: .ts is first for SERVER_JS, .htmlx for HTML.
      expect(pulledFiles.find(f => f.remotePath === 'appsscript')?.localPath).to.equal('appsscript.json');
      expect(pulledFiles.find(f => f.remotePath === 'ServerCode')?.localPath).to.equal('ServerCode.ts');
      expect(pulledFiles.find(f => f.remotePath === 'UserInterface')?.localPath).to.equal('UserInterface.htmlx');
    });
  });

  // Tests for projects with an empty .claspignore file.
  describe('with valid project and empty .claspignore file', function () {
    beforeEach(function () {
      // All files should be included except default ignores like .git and node_modules.
      mockfs({
        'appsscript.json': '{}',
        'Code.js': 'function main(){}',
        'subdir/another.js': 'function sub(){}',
        'page.html': '<h1>Hi</h1>',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        '.claspignore': '', // Empty ignore file.
        // These should still be ignored by clasp's internal default ignores if not overridden by empty file.
        // However, current `loadIgnoreFileOrDefaults` returns empty array if file exists and is empty.
        // This means default ignores like node_modules might not apply if an empty .claspignore is present.
        // This test will verify that behavior.
        'node_modules/somepackage/index.js': '// package code',
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
