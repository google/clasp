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

// This file contains tests for the 'delete-deployment' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {useChaiExtensions} from '../helpers.js';
import {
  forceInteractiveMode,
  mockDeleteDeployment,
  mockListDeployments,
  mockOAuthRefreshRequest,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Delete deployment command', function () {
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

    it('should delete a deployment', async function () {
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
      });
      const out = await runCommand(['delete-deployment', 'mock-deployment-id']);
      return expect(out.stdout).to.contain('Deleted deployment');
    });

    it('should prompt for deployment', async function () {
      mockListDeployments({scriptId: 'mock-script-id'});
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
      });
      forceInteractiveMode(true);
      sinon.stub(inquirer, 'prompt').resolves({deploymentId: 'mock-deployment-id'});
      const out = await runCommand(['delete-deployment']);
      return expect(out.stdout).to.contain('Deleted deployment');
    });

    it('should delete all if specified', async function () {
      mockListDeployments({scriptId: 'mock-script-id'});
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
      });
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id-2',
      });
      const out = await runCommand(['delete-deployment', '--all']);
      return expect(out.stdout).to.contain('Deleted all');
    });
  });
});
