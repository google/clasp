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

// This file contains tests for the 'list-deployments' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {
  mockListDeployments,
  mockListDeploymentsEmpty,
  mockOAuthRefreshRequest,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('List deployments command', function () {
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

    it('should list deployments', async function () {
      mockListDeployments({scriptId: 'mock-script-id'});
      const out = await runCommand(['list-deployments']);
      return expect(out.stdout).to.contain('mock-deployment-id');
    });

    it('should list deployments with a scriptId argument', async function () {
      mockListDeployments({scriptId: 'mock-script-id-arg'});
      const out = await runCommand(['list-deployments', 'mock-script-id-arg']);
      return expect(out.stdout).to.contain('mock-deployment-id');
    });

    it('should output a message when deployments results are empty', async function () {
      mockListDeploymentsEmpty({scriptId: 'mock-script-id'});
      const out = await runCommand(['list-deployments']);
      return expect(out.stdout).to.contain('No deployments');
    });

    it('should list deployments as json', async function () {
      mockListDeployments({scriptId: 'mock-script-id'});
      const out = await runCommand(['list-deployments', '--json']);
      const json = JSON.parse(out.stdout);
      expect(json).to.be.an('array');
      expect(json.length).to.equal(3);
      expect(json[0].deploymentId).to.equal('head-deployment-id');
      expect(json[1].deploymentId).to.equal('mock-deployment-id');
      expect(json[2].deploymentId).to.equal('mock-deployment-id-2');
    });
  });
});
