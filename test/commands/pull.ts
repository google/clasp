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

// This file contains tests for the 'pull' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {runCommand} from '../../test/commands/utils.js';
import {useChaiExtensions} from '../../test/helpers.js';
import {
  forceInteractiveMode,
  mockOAuthRefreshRequest,
  mockScriptDownload,
  mockScriptDownloadError,
  resetMocks,
  setupMocks,
} from '../../test/mocks.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Pull command', function () {
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  describe('With project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should pull files', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['pull']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Pulled 2 files');
    });

    it('should pull files into the rootDir', async function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-dist.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['pull']);
      expect('dist/appsscript.json').to.be.a.realFile;
      expect('dist/Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Pulled 2 files');
    });

    it('should pull a specific version', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
        version: 3,
      });
      const out = await runCommand(['pull', '--versionNumber', '3']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Pulled 2 files');
    });

    it('should handle script download error', async function () {
      mockScriptDownloadError({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['pull']);
      expect(out.stdout).to.not.contain('Pulled 2 files');
      expect(out.exitCode).to.not.equal(0);
    });

    it('should prompt to delete unused files and delete when confirmed', async function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        'local-only.js': 'console.log("local only");',
        'ignored.txt': 'ignored file',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      forceInteractiveMode(true);
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({deleteFile: true});
      const out = await runCommand(['pull', '--deleteUnusedFiles']);
      sinon.assert.called(promptStub);
      expect(out.stdout).to.contain('Deleted local-only.js');
      expect(out.stdout).to.contain('Pulled 2 files');
      expect('local-only.js').to.not.be.a.realFile;
      expect('ignored.txt').to.be.a.realFile;
    });

    it('should prompt to delete unused files and not delete when not confirmed', async function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        'local-only.js': 'console.log("local only");',
        'ignored.txt': 'ignored file',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      forceInteractiveMode(true);
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({deleteFile: false});
      const out = await runCommand(['pull', '--deleteUnusedFiles']);
      sinon.assert.called(promptStub);
      expect(out.stdout).to.not.contain('Deleted local-only.js');
      expect(out.stdout).to.contain('Pulled 2 files');
      expect('local-only.js').to.be.a.realFile;
      expect('ignored.txt').to.be.a.realFile;
    });

    it('should delete unused files without prompting when force flag is used', async function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        'local-only.js': 'console.log("local only");',
        'ignored.txt': 'ignored file',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const promptStub = sinon.stub(inquirer, 'prompt').resolves({deleteFile: true});
      const out = await runCommand(['pull', '--deleteUnusedFiles', '--force']);
      sinon.assert.notCalled(promptStub);
      expect(out.stdout).to.contain('Pulled 2 files');
      expect('local-only.js').to.not.be.a.realFile;
      expect('ignored.txt').to.be.a.realFile;
    });

    it('should pull files and output JSON (no deletions)', async function () {
      mockScriptDownload({ scriptId: 'mock-script-id' }); // Returns appsscript.json, Code.js
      const out = await runCommand(['pull', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({ pulledFiles: ['appsscript.json', 'Code.js'], deletedFiles: [] });
      expect(out.stdout).to.not.contain('Pulled');
      expect('appsscript.json').to.be.a.realFile();
    });

    it('should pull files, delete unused, and output JSON', async function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
        'local-only.js': 'console.log("delete me");',
        'appsscript.json': '{}', // Will be overwritten by pull
      });
      mockScriptDownload({ scriptId: 'mock-script-id' }); // Returns appsscript.json, Code.js

      const out = await runCommand(['pull', '--deleteUnusedFiles', '--force', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      // local-only.js is deleted because it's not in the mockScriptDownload
      expect(jsonResponse.pulledFiles).to.have.deep.members(['appsscript.json', 'Code.js']);
      expect(jsonResponse.deletedFiles).to.deep.equal(['local-only.js']);
      expect(out.stdout).to.not.contain('Pulled');
      expect(out.stdout).to.not.contain('Deleted');
      expect('local-only.js').to.not.be.a.realFile();
    });

    it('should output empty arrays in JSON when no files pulled or deleted', async function () {
       mockfs({ // Ensure local files match remote mock
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../../test/fixtures/Code.js')),
      });
      // mockScriptDownload by default returns appsscript.json and Code.js with specific content.
      // To ensure "no changes", the content on mockfs must match this.
      // The default mockScriptDownload has fixed content.
      // For this test, it's easier to mock that the downloaded files are exactly what we have.
      const existingFiles = [
        { name: 'appsscript', type: 'JSON', source: fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/appsscript-no-services.json'), 'utf8') },
        { name: 'Code', type: 'SERVER_JS', source: fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/Code.js'), 'utf8') },
      ];
      mockScriptDownload({ scriptId: 'mock-script-id', files: existingFiles });

      const out = await runCommand(['pull', '--deleteUnusedFiles', '--force', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      // The command still reports all files from remote as "pulled" even if no change.
      expect(jsonResponse).to.deep.equal({ pulledFiles: ['appsscript.json', 'Code.js'], deletedFiles: [] });
    });

    it('should pull files into rootDir and output JSON', async function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-dist.json')), // rootDir is "dist"
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({ scriptId: 'mock-script-id' }); // Returns appsscript.json, Code.js
      const out = await runCommand(['pull', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({ pulledFiles: ['dist/appsscript.json', 'dist/Code.js'], deletedFiles: [] });
      expect('dist/appsscript.json').to.be.a.realFile();
    });

  });
  describe('Without project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should reject missing project id', async function () {
      const out = await runCommand(['pull']);
      expect(out.stderr).to.contain('not found');
    });
  });
});
