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

// This file contains tests for the 'open-web-app' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import inquirer from 'inquirer'; // For mocking prompt for deployment
import nock from 'nock'; // For mocking API calls directly if needed for entryPoints

import * as commandUtils from '../../src/commands/utils.js';
import {Clasp} from '../../src/core/clasp.js';
import {Project} from '../../src/core/project.js'; // To stub project methods like listDeployments, entryPoints
import {useChaiExtensions} from '../helpers.js';
import {
  resetMocks,
  setupMocks,
  mockOAuthRefreshRequest,
  mockListDeployments, // Already provides some deployments
  forceInteractiveMode,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_ID = 'mock-script-id-webapp';
const DEPLOYMENT_ID_ARG = 'mock-deployment-id-arg';
const MOCK_WEBAPP_URL = 'https://script.google.com/macros/s/mock-webapp-exec-url/exec';

describe('Open Web App command (open-web-app)', function () {
  let openUrlStub: sinon.SinonStub;
  let authorizedUserStub: sinon.SinonStub;
  let listDeploymentsStub: sinon.SinonStub;
  let entryPointsStub: sinon.SinonStub;

  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
    openUrlStub = sinon.stub(commandUtils, 'openUrl').resolves();
    authorizedUserStub = sinon.stub(Clasp.prototype, 'authorizedUser').resolves('user@example.com');

    // Stub Project methods used by the command
    listDeploymentsStub = sinon.stub(Project.prototype, 'listDeployments');
    entryPointsStub = sinon.stub(Project.prototype, 'entryPoints');

    mockfs({
      '.clasp.json': JSON.stringify({scriptId: SCRIPT_ID}),
      [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
        path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
      ),
    });
  });

  afterEach(function () {
    openUrlStub.restore();
    authorizedUserStub.restore();
    listDeploymentsStub.restore();
    entryPointsStub.restore();
    resetMocks();
    mockfs.restore();
  });

  const expectedUrlWithUserHint = `${MOCK_WEBAPP_URL}?authuser=user%40example.com`; // authuser, not authUser for webapp URLs
  const expectedUrlWithoutUserHint = MOCK_WEBAPP_URL; // Actual URL might vary based on INCLUDE_USER_HINT_IN_URL experiment

  // Helper to determine expected URL based on INCLUDE_USER_HINT_IN_URL (which is true by default in tests)
  // The webapp URL constructed by the command does NOT add authUser if the URL already has query params.
  // The mock MOCK_WEBAPP_URL does not. So it WILL add it.
  const getFinalExpectedUrl = (baseUrl: string) => {
    // Assuming INCLUDE_USER_HINT_IN_URL = true for tests
    // Webapp URL construction is complex; it tries to preserve existing params.
    // Our MOCK_WEBAPP_URL has no params, so authuser will be added.
    // Note: open-webapp itself uses 'authUser', but the final URL from API might be 'authuser'.
    // The command's openUrl call uses url.searchParams.set('authUser', userHint ?? '');
    // For this test, let's assume the MOCK_WEBAPP_URL is what we get and then authUser is added.
    return `${baseUrl}?authUser=user%40example.com`;
  };


  it('should open webapp with specified deploymentId (text mode)', async function () {
    entryPointsStub.withArgs(DEPLOYMENT_ID_ARG).resolves([{entryPointType: 'WEB_APP', webApp: {url: MOCK_WEBAPP_URL}}]);
    const finalExpectedUrl = getFinalExpectedUrl(MOCK_WEBAPP_URL);

    const out = await runCommand(['open-web-app', DEPLOYMENT_ID_ARG]);

    expect(entryPointsStub.calledOnceWith(DEPLOYMENT_ID_ARG)).to.be.true;
    expect(openUrlStub.calledOnceWith(finalExpectedUrl)).to.be.true;
    expect(out.stdout).to.equal('');
  });

  it('should open webapp with specified deploymentId and output JSON', async function () {
    entryPointsStub.withArgs(DEPLOYMENT_ID_ARG).resolves([{entryPointType: 'WEB_APP', webApp: {url: MOCK_WEBAPP_URL}}]);
    const finalExpectedUrl = getFinalExpectedUrl(MOCK_WEBAPP_URL);

    const out = await runCommand(['open-web-app', DEPLOYMENT_ID_ARG, '--json']);

    expect(entryPointsStub.calledOnceWith(DEPLOYMENT_ID_ARG)).to.be.true;
    expect(openUrlStub.calledOnceWith(finalExpectedUrl)).to.be.true;
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({url: finalExpectedUrl});
  });

  it('should prompt for deploymentId if not provided (interactive text mode)', async function () {
    const deploymentsFixture = {
      results: [
        {deploymentId: 'dep1', deploymentConfig: {description: 'WebApp1'}, updateTime: '2023-01-01'},
        {deploymentId: 'dep2', deploymentConfig: {description: 'WebApp2'}, updateTime: '2023-01-02'},
      ],
    };
    listDeploymentsStub.resolves(deploymentsFixture);
    entryPointsStub.withArgs('dep2').resolves([{entryPointType: 'WEB_APP', webApp: {url: MOCK_WEBAPP_URL}}]);
    const finalExpectedUrl = getFinalExpectedUrl(MOCK_WEBAPP_URL);

    forceInteractiveMode(true);
    const inquirerStub = sinon.stub(inquirer, 'prompt').resolves({deployment: 'dep2'});

    const out = await runCommand(['open-web-app']);

    expect(listDeploymentsStub.calledOnce).to.be.true;
    expect(inquirerStub.calledOnce).to.be.true;
    expect(entryPointsStub.calledOnceWith('dep2')).to.be.true;
    expect(openUrlStub.calledOnceWith(finalExpectedUrl)).to.be.true;
    expect(out.stdout).to.equal('');
    inquirerStub.restore();
  });

  it('should prompt for deploymentId and output JSON (interactive mode)', async function () {
    const deploymentsFixture = {
      results: [
        {deploymentId: 'dep1', deploymentConfig: {description: 'WebApp1'}, updateTime: '2023-01-01'},
        {deploymentId: 'dep2', deploymentConfig: {description: 'WebApp2'}, updateTime: '2023-01-02'},
      ],
    };
    listDeploymentsStub.resolves(deploymentsFixture);
    entryPointsStub.withArgs('dep1').resolves([{entryPointType: 'WEB_APP', webApp: {url: MOCK_WEBAPP_URL}}]);
    const finalExpectedUrl = getFinalExpectedUrl(MOCK_WEBAPP_URL);

    forceInteractiveMode(true);
    const inquirerStub = sinon.stub(inquirer, 'prompt').resolves({deployment: 'dep1'});

    const out = await runCommand(['open-web-app', '--json']);

    expect(listDeploymentsStub.calledOnce).to.be.true;
    expect(inquirerStub.calledOnce).to.be.true;
    expect(entryPointsStub.calledOnceWith('dep1')).to.be.true;
    expect(openUrlStub.calledOnceWith(finalExpectedUrl)).to.be.true;

    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({url: finalExpectedUrl});
    inquirerStub.restore();
  });

  it('should error if no web app entry point found (text mode)', async function () {
    entryPointsStub.withArgs(DEPLOYMENT_ID_ARG).resolves([{entryPointType: 'API_EXECUTABLE'}]); // No WEB_APP
    const out = await runCommand(['open-web-app', DEPLOYMENT_ID_ARG]);
    expect(entryPointsStub.calledOnce).to.be.true;
    expect(openUrlStub.notCalled).to.be.true;
    expect(out.stderr).to.contain('No web app entry point found.');
  });

  it('should error if no web app entry point found (JSON mode)', async function () {
    entryPointsStub.withArgs(DEPLOYMENT_ID_ARG).resolves([{entryPointType: 'API_EXECUTABLE'}]);
    const out = await runCommand(['open-web-app', DEPLOYMENT_ID_ARG, '--json']);
    expect(entryPointsStub.calledOnce).to.be.true;
    expect(openUrlStub.notCalled).to.be.true;
    expect(out.stderr).to.contain('No web app entry point found.');
    expect(out.stdout).to.equal(''); // No JSON output
  });
});
