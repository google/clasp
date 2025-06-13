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

// This file contains tests for the 'update-deployment' (alias 'redeploy') command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';

import {useChaiExtensions} from '../helpers.js';
import {
  mockUpdateDeployment, // Primary mock for this command
  mockOAuthRefreshRequest,
  resetMocks,
  setupMocks,
} from '../mocks.js'; // Assuming mockUpdateDeployment exists and is suitable
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Update deployment command (redeploy)', function () {
  let consoleLogSpy: sinon.SinonSpy;

  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
    consoleLogSpy = sinon.spy(console, 'log');
    mockfs({
      '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')), // scriptId: 'mock-script-id'
      [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
        path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
      ),
    });
  });

  afterEach(function () {
    consoleLogSpy.restore();
    resetMocks();
    mockfs.restore();
  });

  const deploymentIdToUpdate = 'existing-dep-id';
  const scriptId = 'mock-script-id'; // from dot-clasp-no-settings.json

  it('should update deployment with version and description (text output)', async function () {
    const version = 2;
    const description = 'Updated description for text test';
    mockUpdateDeployment({
      scriptId,
      deploymentId: deploymentIdToUpdate,
      version,
      description,
    });

    await runCommand(['update-deployment', deploymentIdToUpdate, '-V', String(version), '-d', description]);
    expect(consoleLogSpy.calledWith(sinon.match(`Redeployed ${deploymentIdToUpdate} @${version}`))).to.be.true;
  });

  it('should update deployment and output JSON', async function () {
    const version = 3;
    const description = 'Updated description for JSON test';
     mockUpdateDeployment({ // mockUpdateDeployment returns the updated deployment object
      scriptId,
      deploymentId: deploymentIdToUpdate,
      version,
      description,
    });

    const out = await runCommand(['update-deployment', deploymentIdToUpdate, '-V', String(version), '-d', description, '--json']);

    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({deploymentId: deploymentIdToUpdate, version});
    expect(consoleLogSpy.called).to.be.false; // No text output
  });

  it('should update deployment to @HEAD and output JSON', async function () {
    // Not providing a version number means it deploys @HEAD
    const description = 'Update to @HEAD for JSON';
    mockUpdateDeployment({
      scriptId,
      deploymentId: deploymentIdToUpdate,
      // version is undefined for @HEAD in the mock's reply if not specified for request
      description,
    });

    const out = await runCommand(['update-deployment', deploymentIdToUpdate, '-d', description, '--json']);

    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    // mockUpdateDeployment returns version if provided, or undefined if not.
    // The command's JSON output for version is `deployment.deploymentConfig?.versionNumber`
    // So, if version is undefined in mock, it will be undefined in JSON.
    expect(jsonResponse).to.deep.equal({deploymentId: deploymentIdToUpdate, version: undefined});
    expect(consoleLogSpy.called).to.be.false;
  });

  it('should error if deploymentId is missing (no JSON output)', async function () {
    // This command structure in Commander makes deploymentId a required argument.
    // If not provided, Commander itself will error before our action is called.
    // We can test this by trying to run without it.
    const out = await runCommand(['update-deployment', '--json']); // Missing deploymentId
    // Expect an error message from Commander, not our JSON.
    expect(out.stderr).to.contain("error: missing required argument 'deploymentId'");
    expect(out.stdout).to.equal(''); // No JSON output
  });

  it('should use alias "redeploy" and output JSON', async function () {
    const version = 4;
    const description = 'Alias redeploy test';
    mockUpdateDeployment({
      scriptId,
      deploymentId: deploymentIdToUpdate,
      version,
      description,
    });

    const out = await runCommand(['redeploy', deploymentIdToUpdate, '-V', String(version), '-d', description, '--json']);
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({deploymentId: deploymentIdToUpdate, version});
  });
});
