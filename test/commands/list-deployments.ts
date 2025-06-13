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
import {mockListDeployments, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
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

    it('should list deployments in JSON format', async function () {
      mockListDeployments({scriptId: 'mock-script-id'});
      const out = await runCommand(['list-deployments', '--json']);

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      const expectedDeployments = [
        {deploymentId: 'head-deployment-id', version: undefined, description: 'Head deployment'},
        {deploymentId: 'mock-deployment-id', version: 1, description: 'lorem ipsum'},
        {deploymentId: 'mock-deployment-id-2', version: 2, description: 'lorem ipsum'},
      ];

      expect(jsonResponse.deployments).to.be.an('array');
      // Order might not be guaranteed unless the command sorts it, the mock provides a fixed order.
      // Using deep.members to be robust against order changes if any.
      expect(jsonResponse.deployments).to.deep.members(expectedDeployments);
      expect(jsonResponse.deployments.length).to.equal(expectedDeployments.length);

      expect(out.stdout).to.not.contain('Found'); // Text from normal output
    });

    it('should list deployments using alias "deployments" in JSON format', async function () {
      mockListDeployments({scriptId: 'mock-script-id'});
      const out = await runCommand(['deployments', '--json']); // Using alias

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      const expectedDeployments = [
        {deploymentId: 'head-deployment-id', version: undefined, description: 'Head deployment'},
        {deploymentId: 'mock-deployment-id', version: 1, description: 'lorem ipsum'},
        {deploymentId: 'mock-deployment-id-2', version: 2, description: 'lorem ipsum'},
      ];

      expect(jsonResponse.deployments).to.deep.members(expectedDeployments);
      expect(jsonResponse.deployments.length).to.equal(expectedDeployments.length);
      expect(out.stdout).to.not.contain('Found');
    });

    it('should output empty array for no deployments in JSON format', async function () {
      // Direct nock usage for empty deployments list as mockListDeployments is not flexible enough
      nock('https://script.googleapis.com')
        .get(`/v1/projects/mock-script-id/deployments`)
        .query(true)
        .reply(200, {deployments: []});

      const out = await runCommand(['list-deployments', '--json']);

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse).to.deep.equal({deployments: []});
      expect(out.stdout).to.not.contain('No deployments.'); // Text from normal output
    });
  });
});
