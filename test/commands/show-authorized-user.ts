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

// This file contains tests for the 'show-authorized-user' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';

import * as auth from '../../src/auth/auth.js'; // To mock getUserInfo
import {useChaiExtensions} from '../helpers.js';
import {resetMocks, setupMocks} from '../mocks.js'; // Basic mocks
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Show authorized user command', function () {
  let getUserInfoStub: sinon.SinonStub;
  let consoleLogSpy: sinon.SinonSpy;

  beforeEach(function () {
    setupMocks(); // Basic nock, mockfs, env setup
    // This command relies on `auth.credentials` being populated by `initAuth`
    // and then calls `getUserInfo`.
    getUserInfoStub = sinon.stub(auth, 'getUserInfo');
    consoleLogSpy = sinon.spy(console, 'log');
  });

  afterEach(function () {
    getUserInfoStub.restore();
    consoleLogSpy.restore();
    resetMocks();
    mockfs.restore();
  });

  describe('When logged in', function () {
    beforeEach(function () {
      // Simulate being logged in by providing a .clasprc.json with credentials
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
        // .clasp.json is not strictly needed as this command doesn't interact with project settings
      });
      getUserInfoStub.resolves({
        email: 'mock.user@example.com',
        name: 'Mock User',
      } as auth.UserInfo);
    });

    it('should print user email for text output', async function () {
      await runCommand(['show-authorized-user']);
      expect(getUserInfoStub.calledOnce).to.be.true;
      expect(consoleLogSpy.calledWith(sinon.match('You are logged in as mock.user@example.com'))).to.be.true;
    });

    it('should output JSON with user email', async function () {
      const out = await runCommand(['show-authorized-user', '--json']);
      expect(getUserInfoStub.calledOnce).to.be.true;
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({email: 'mock.user@example.com'});
      expect(consoleLogSpy.called).to.be.false; // Text output should be suppressed
    });
  });

  describe('When not logged in', function () {
    beforeEach(function () {
      // Simulate not being logged in (e.g., empty or no .clasprc.json)
      // initAuth will result in auth.credentials being undefined.
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: '{}',
      });
      // getUserInfoStub should not be called if not logged in
    });

    it('should print "Not logged in." for text output', async function () {
      await runCommand(['show-authorized-user']);
      expect(getUserInfoStub.notCalled).to.be.true;
      expect(consoleLogSpy.calledWith('Not logged in.')).to.be.true;
    });

    it('should output JSON with null email', async function () {
      const out = await runCommand(['show-authorized-user', '--json']);
      expect(getUserInfoStub.notCalled).to.be.true;
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({email: null});
      expect(consoleLogSpy.called).to.be.false;
    });
  });
});
