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

// This file contains tests for the 'clone-script' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {useChaiExtensions} from '../helpers.js';
import {
  forceInteractiveMode,
  mockListScripts,
  mockOAuthRefreshRequest,
  mockScriptDownload,
  mockScriptDownloadError,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Clone script command', function () {
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  // Test suite for cloning operations when the target directory is clean (no existing .clasp.json)
  // and the user is authenticated.
  describe('With clean dir, authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with only the authentication file.
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should clone a project with scriptId correctly', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'mock-script-id']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect('.clasp.json').to.be.a.realFile;
      const projectConfig = JSON.parse(await fs.readFile('.clasp.json', {encoding: 'utf8'}));
      expect(projectConfig.scriptId).to.equal('mock-script-id');
      expect(out.stdout).to.contain('Cloned');
    });

    it('should clone a project with script URL correctly', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'https://script.google.com/d/mock-script-id/edit']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should clone a specfic version', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
        version: 2,
      });
      const out = await runCommand(['clone', 'mock-script-id', '2']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should use the provided root directory', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'mock-script-id', '--rootDir', 'dist']);
      expect('dist/appsscript.json').to.be.a.realFile;
      expect('dist/Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    // Tests the interactive flow when no script ID is provided as an argument.
    it('should prompt if no script provided', async function () {
      mockListScripts(); // Mocks the API call to list available scripts.
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      forceInteractiveMode(true); // Ensure interactive mode is on for tests.
      // Stub inquirer to automatically select 'mock-script-id' when prompted.
      sinon.stub(inquirer, 'prompt').resolves({scriptId: 'mock-script-id'});
      const out = await runCommand(['clone']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should give an error if no script and not interactive', async function () {
      forceInteractiveMode(false);
      const out = await runCommand(['clone']);
      return expect(out.stderr).to.contain('No script ID');
    });

    // Tests error handling when attempting to clone a script that doesn't exist or is inaccessible.
    it('should give an error on a non-existing project', async function () {
      mockScriptDownloadError({
        scriptId: 'non-existing-project', // Mocks an API error for this script ID.
      });
      const out = await runCommand(['clone', 'non-existing-project']);
      return expect(out.stderr).to.contain('Invalid script ID');
    });

    // Ensures that if the cloning process (file download) fails, no .clasp.json is created.
    it('should not write .clasp.json if unable to clone', async function () {
      mockScriptDownloadError({
        scriptId: 'mock-script-id', // Simulate an error during the download for this ID.
      });
      await runCommand(['clone', 'mock-script-id']);
      expect('.clasp.json').to.not.be.a.realFile; // Verifies that the config file was not created.
    });

    it('should clone a project as json', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'mock-script-id', '--json']);
      const json = JSON.parse(out.stdout);
      expect(json.scriptId).to.equal('mock-script-id');
      expect(json.files).to.be.an('array');
      expect(json.files.length).to.equal(2);
    });
  });

  // Test suite for scenarios where a .clasp.json file already exists in the directory,
  // indicating a project might already be cloned or initialized here.
  describe('With existing project, authenticated', function () {
    beforeEach(function () {
      // Set up a mock filesystem with an existing .clasp.json and auth file.
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should give error if .clasp.json exists', async function () {
      const out = await runCommand(['clone', 'mock-id']);
      // Verifies that the clone command fails if a .clasp.json file already exists,
      // preventing accidental overwrites.
      return expect(out.stderr).to.contain('already exists');
    });
  });
});
