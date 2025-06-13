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

// This file contains tests for the 'create-deployment' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {
  mockCreateDeployment,
  mockCreateVersion,
  mockOAuthRefreshRequest,
  mockUpdateDeployment,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Create deployment command', function () {
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
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    // This test case verifies the default behavior of 'deploy' command:
    // it should create a new script version (if no version is specified)
    // and then create a new deployment using that version with a default description.
    it('should create version and use default description', async function () {
      mockCreateVersion({
        scriptId: 'mock-script-id',
        version: 1,
      });
      mockCreateDeployment({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['deploy']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @1');
    });

    it('should use provided version id', async function () {
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        version: 2,
      });
      const out = await runCommand(['deploy', '-V', '2']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @2');
    });

    it('should use provided description', async function () {
      mockCreateVersion({
        scriptId: 'mock-script-id',
        description: 'test',
        version: 1,
      });
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        description: 'test',
      });
      const out = await runCommand(['deploy', '-d', 'test']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @1');
    });

    it('should update existing deployment', async function () {
      mockUpdateDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
        version: 2,
      });
      const out = await runCommand(['deploy', '-i', 'mock-deployment-id', '-V', '2']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @2');
    });

    it('should create version, deploy, and output JSON', async function () {
      mockCreateVersion({
        scriptId: 'mock-script-id',
        version: 1,
      });
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        version: 1, // Ensure this matches the created version
        description: '', // Default description
      });
      const out = await runCommand(['deploy', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({deploymentId: 'mock-deployment-id', version: 1});
      expect(out.stdout).to.not.contain('Deployed');
    });

    it('should use provided version, deploy, and output JSON', async function () {
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        version: 2,
        description: '', // Default description
      });
      const out = await runCommand(['deploy', '-V', '2', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({deploymentId: 'mock-deployment-id', version: 2});
      expect(out.stdout).to.not.contain('Deployed');
    });

    it('should update existing deployment and output JSON', async function () {
      mockUpdateDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'existing-dep-id',
        version: 3,
        description: '', // Default description
      });
      const out = await runCommand(['deploy', '-i', 'existing-dep-id', '-V', '3', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({deploymentId: 'existing-dep-id', version: 3});
      expect(out.stdout).to.not.contain('Deployed');
    });

    it('should deploy with description and output JSON', async function () {
      mockCreateVersion({
        scriptId: 'mock-script-id',
        description: 'JSON test description',
        version: 1,
      });
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        description: 'JSON test description',
        version: 1,
      });
      const out = await runCommand(['deploy', '-d', 'JSON test description', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      // The description itself is not part of this command's JSON output format
      expect(jsonResponse).to.deep.equal({deploymentId: 'mock-deployment-id', version: 1});
      expect(out.stdout).to.not.contain('Deployed');
    });
  });
});
