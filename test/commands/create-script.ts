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

// This file contains tests for the 'create-script' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {getDefaultProjectName} from '../../src/commands/create-script.js';
import {useChaiExtensions} from '../helpers.js';
import {
  mockCreateBoundScript,
  mockCreateScript,
  mockOAuthRefreshRequest,
  mockScriptDownload,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Create script command', function () {
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Test suite for 'create' command scenarios where the user is authenticated
  // and there is no existing .clasp.json file (i.e., creating a new project locally).
  describe('With project, authenticated', function () {
    beforeEach(function () {
      // Mock filesystem with only the global authentication file.
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // This test case verifies the default behavior of 'create' (no specific type or title).
    // It should create a standalone script with a default name derived from the current directory
    // and then clone the initial files.
    // Note: The test name 'should create a version' seems to be a misnomer from a previous copy-paste.
    it('should create a version', async function () {
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: getDefaultProjectName(process.cwd()),
      });

      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should create a bound script', async function () {
      mockCreateBoundScript({
        scriptId: 'mock-script-id',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        title: 'test sheet',
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--type', 'sheets', '--title', 'test sheet']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should create a standalone script with given title', async function () {
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: 'test',
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--title', 'test']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should use the given root directory', async function () {
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: 'test',
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--title', 'test', '--rootDir', 'dist']);
      expect('dist/appsscript.json').to.be.a.realFile;
      expect('dist/Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should create standalone script, clone, and output JSON', async function () {
      const scriptTitle = 'json-standalone-test';
      const mockScriptId = 'mock-script-id-json-standalone';
      const expectedClonedFiles = ['appsscript.json', 'Code.js'];
      mockCreateScript({
        scriptId: mockScriptId,
        title: scriptTitle,
      });
      mockScriptDownload({ // Mock download for the newly created scriptId
        scriptId: mockScriptId,
        files: [{name: 'appsscript', type: 'JSON', source: '{}'}, {name: 'Code', type: 'SERVER_JS', source: '// Code'}]
      });

      const out = await runCommand(['create', '--title', scriptTitle, '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse.scriptId).to.equal(mockScriptId);
      expect(jsonResponse.parentId).to.be.undefined; // Standalone by default doesn't have a container parentId unless specified
      expect(jsonResponse.clonedFiles).to.deep.equal(expectedClonedFiles);
      expect(out.stdout).to.not.contain('Created new script');
      expect(out.stdout).to.not.contain('Cloned');
      for (const file of expectedClonedFiles) {
        expect(file).to.be.a.realFile();
      }
    });

    it('should create bound script (sheets), clone, and output JSON', async function () {
      const scriptTitle = 'test sheet'; // Title must match mockCreateBoundScript's expectation
      const mockScriptId = 'mock-script-id-json-bound-sheet';
      const mockParentId = 'mock-parent-id-sheet-json';
      const expectedClonedFiles = ['appsscript.json', 'Code.js'];

      mockCreateBoundScript({
        scriptId: mockScriptId,
        title: scriptTitle,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parentId: mockParentId,
      });
      mockScriptDownload({ // Mock download for the newly created scriptId
        scriptId: mockScriptId,
         files: [{name: 'appsscript', type: 'JSON', source: '{}'}, {name: 'Code', type: 'SERVER_JS', source: '// Code'}]
      });

      // Note: The title passed to `create --type sheets` is for the Google Sheet,
      // the Apps Script project might get a default or same title.
      // The `mockCreateBoundScript` in mocks.ts has specific expectations for titles.
      // The command actually uses the title for the container, and the script project gets the same title.
      const out = await runCommand(['create', '--type', 'sheets', '--title', scriptTitle, '--json']);

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse.scriptId).to.equal(mockScriptId);
      expect(jsonResponse.parentId).to.equal(mockParentId);
      expect(jsonResponse.clonedFiles).to.deep.equal(expectedClonedFiles);
      expect(out.stdout).to.not.contain('Created new document');
      expect(out.stdout).to.not.contain('Created new script');
      expect(out.stdout).to.not.contain('Cloned');
      for (const file of expectedClonedFiles) {
        expect(file).to.be.a.realFile();
      }
    });
     it('should create standalone in rootDir, clone, and output JSON', async function () {
      const scriptTitle = 'json-standalone-rootdir';
      const mockScriptId = 'mock-script-id-json-rootdir';
      const rootDir = 'distTest';
      const expectedClonedFiles = [path.join(rootDir, 'appsscript.json'), path.join(rootDir, 'Code.js')];

      mockCreateScript({
        scriptId: mockScriptId,
        title: scriptTitle,
      });
      mockScriptDownload({
        scriptId: mockScriptId,
        files: [{name: 'appsscript', type: 'JSON', source: '{}'}, {name: 'Code', type: 'SERVER_JS', source: '// Code'}]
      });

      const out = await runCommand(['create', '--title', scriptTitle, '--rootDir', rootDir, '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse.scriptId).to.equal(mockScriptId);
      expect(jsonResponse.clonedFiles).to.deep.equal(expectedClonedFiles);

      for (const file of expectedClonedFiles) {
        expect(file).to.be.a.realFile();
      }
      // Check .clasp.json in rootDir
      expect(path.join(rootDir, '.clasp.json')).to.be.a.realFile();
    });
  });
  describe('With existing project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should give error if .clasp.json exists', async function () {
      const out = await runCommand(['create']);
      // Verifies that the create command fails if a .clasp.json file already exists,
      // to prevent accidentally overwriting an existing project setup.
      return expect(out.stderr).to.contain('already exists');
    });
  });
});
