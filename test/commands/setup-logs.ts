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

// This file contains tests for the 'setup-logs' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import inquirer from 'inquirer'; // For mocking prompt for project ID

import {useChaiExtensions} from '../helpers.js';
import {
  mockOAuthRefreshRequest,
  resetMocks,
  setupMocks,
  forceInteractiveMode,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Setup logs command', function () {
  let consoleLogSpy: sinon.SinonSpy;

  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
    consoleLogSpy = sinon.spy(console, 'log');
  });

  afterEach(function () {
    consoleLogSpy.restore();
    resetMocks();
    mockfs.restore();
  });

  describe('With GCP project configured', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')), // Has projectId
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should print success message (text output)', async function () {
      await runCommand(['setup-logs']);
      expect(consoleLogSpy.calledWith(sinon.match(/Script logs are now available/))).to.be.true;
    });

    it('should output JSON status success', async function () {
      const out = await runCommand(['setup-logs', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({status: 'success'});
      expect(consoleLogSpy.called).to.be.false; // No text output
    });
  });

  describe('Without GCP project configured (prompting)', function () {
    let promptStub: sinon.SinonStub;

    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')), // No projectId
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      forceInteractiveMode(true);
      promptStub = sinon.stub(inquirer, 'prompt').resolves({projectId: 'prompted-project-id'});
    });

    afterEach(function() {
      promptStub.restore();
    });

    it('should prompt for project ID, then print success message (text output)', async function () {
      await runCommand(['setup-logs']);
      expect(promptStub.calledOnce).to.be.true;
      // The Project.prototype.setProjectId would be called, and .clasp.json updated.
      // This test primarily cares about the command's flow and final output.
      expect(consoleLogSpy.calledWith(sinon.match(/Script logs are now available/))).to.be.true;
    });

    it('should prompt for project ID, then output JSON status success', async function () {
      const out = await runCommand(['setup-logs', '--json']);
      expect(promptStub.calledOnce).to.be.true;
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({status: 'success'});
      expect(consoleLogSpy.called).to.be.false;
    });
  });

  // Non-interactive without project ID would error due to assertGcpProjectConfigured
  // This is implicitly tested by other commands, can add explicit if needed.
});
