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

// This file contains tests for the 'open-script' command.

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
const SCRIPT_ID_FROM_FILE = 'script-id-from-file';
const SCRIPT_ID_ARG = 'script-id-from-argument';

describe('Open Script command (open-script)', function () {
  let openUrlStub: sinon.SinonStub;
  let authorizedUserStub: sinon.SinonStub;

  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
    openUrlStub = sinon.stub(commandUtils, 'openUrl').resolves();
    authorizedUserStub = sinon.stub(Clasp.prototype, 'authorizedUser').resolves('user@example.com');

    mockfs({
      '.clasp.json': JSON.stringify({scriptId: SCRIPT_ID_FROM_FILE}),
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

  const baseUrl = 'https://script.google.com/d/';
  const userParam = '&authUser=user%40example.com';

  it('should open script from .clasp.json in text mode', async function () {
    const expectedUrl = `${baseUrl}${SCRIPT_ID_FROM_FILE}/edit${userParam}`;
    const out = await runCommand(['open-script']);
    expect(openUrlStub.calledOnceWith(expectedUrl)).to.be.true;
    expect(out.stdout).to.equal('');
  });

  it('should open script from .clasp.json and output JSON', async function () {
    const expectedUrl = `${baseUrl}${SCRIPT_ID_FROM_FILE}/edit${userParam}`;
    const out = await runCommand(['open-script', '--json']);
    expect(openUrlStub.calledOnceWith(expectedUrl)).to.be.true;
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({url: expectedUrl});
  });

  it('should open script specified by argument in text mode, overriding .clasp.json', async function () {
    const expectedUrl = `${baseUrl}${SCRIPT_ID_ARG}/edit${userParam}`;
    const out = await runCommand(['open-script', SCRIPT_ID_ARG]);
    expect(openUrlStub.calledOnceWith(expectedUrl)).to.be.true;
    expect(out.stdout).to.equal('');
  });

  it('should open script specified by argument and output JSON, overriding .clasp.json', async function () {
    const expectedUrl = `${baseUrl}${SCRIPT_ID_ARG}/edit${userParam}`;
    const out = await runCommand(['open-script', SCRIPT_ID_ARG, '--json']);
    expect(openUrlStub.calledOnceWith(expectedUrl)).to.be.true;
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({url: expectedUrl});
  });

  it('should error if no scriptId is available (text mode)', async function () {
    mockfs({ // No .clasp.json
      [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
        path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
      ),
    });
    const out = await runCommand(['open-script']);
    expect(openUrlStub.notCalled).to.be.true;
    expect(out.stderr).to.contain('Script ID not set');
  });

  it('should error if no scriptId is available (JSON mode)', async function () {
    mockfs({ // No .clasp.json
       [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
        path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
      ),
    });
    const out = await runCommand(['open-script', '--json']);
    expect(openUrlStub.notCalled).to.be.true;
    expect(out.stderr).to.contain('Script ID not set');
    expect(out.stdout).to.equal(''); // No JSON output
  });
});
