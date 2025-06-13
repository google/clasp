// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You mayอนาคารสงเคราะห์, Version 2.0 (the "License");
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

// This file contains tests for the 'open-api-console' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';

import * as commandUtils from '../../src/commands/utils.js';
import {Clasp} from '../../src/core/clasp.js'; // To stub authorizedUser
import {useChaiExtensions} from '../helpers.js';
import {
  resetMocks,
  setupMocks,
  mockOAuthRefreshRequest,
} from '../mocks.js';
import {runCommand} from './utils.js';


useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_ID = 'mock-script-id'; // Not directly used by open-api-console, but for consistency
const PROJECT_ID = 'mock-gcp-project'; // Crucial for this command

describe('Open API Console command (open-api-console)', function () {
  let openUrlStub: sinon.SinonStub;
  let authorizedUserStub: sinon.SinonStub;

  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
    openUrlStub = sinon.stub(commandUtils, 'openUrl').resolves();
    authorizedUserStub = sinon.stub(Clasp.prototype, 'authorizedUser').resolves('user@example.com');

    mockfs({
      '.clasp.json': JSON.stringify({scriptId: SCRIPT_ID, projectId: PROJECT_ID}),
      [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
        path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
      ),
    });
  });

  afterEach(function () {
    openUrlStub.restore();
    authorizedUserStub.restore();
    resetMocks();
    mockfs.restore();
  });

  const expectedBaseUrl = 'https://console.developers.google.com/apis/dashboard';
  const expectedUrl = `${expectedBaseUrl}?project=${PROJECT_ID}&authUser=user%40example.com`;
  // Note: INCLUDE_USER_HINT_IN_URL is true by default in tests if not changed by experiments.js mock

  it('should open the API console URL in text mode', async function () {
    const out = await runCommand(['open-api-console']);
    expect(openUrlStub.calledOnceWith(expectedUrl)).to.be.true;
    expect(out.stdout).to.equal(''); // Command is silent
  });

  it('should open API console URL and output JSON', async function () {
    const out = await runCommand(['open-api-console', '--json']);

    expect(openUrlStub.calledOnceWith(expectedUrl)).to.be.true;

    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({url: expectedUrl});
  });
});
