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

// This file contains tests for the 'open-logs' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';

import * as commandUtils from '../../src/commands/utils.js';
import {Clasp} from '../../src/core/clasp.js';
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
const SCRIPT_ID = 'mock-script-id';
const PROJECT_ID = 'mock-gcp-project-logs';

describe('Open Logs command (open-logs)', function () {
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

  const expectedBaseUrl = 'https://console.cloud.google.com/logs/viewer';
  // resource=app_script_function is a fixed part of this command's URL
  const expectedUrl = `${expectedBaseUrl}?project=${PROJECT_ID}&resource=app_script_function&authUser=user%40example.com`;

  it('should open the logs URL in text mode', async function () {
    const out = await runCommand(['open-logs']);
    expect(openUrlStub.calledOnceWith(expectedUrl)).to.be.true;
    expect(out.stdout).to.equal('');
  });

  it('should open logs URL and output JSON', async function () {
    const out = await runCommand(['open-logs', '--json']);

    expect(openUrlStub.calledOnceWith(expectedUrl)).to.be.true;

    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({url: expectedUrl});
  });
});
