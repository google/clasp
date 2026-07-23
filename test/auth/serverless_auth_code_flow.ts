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

// This file contains tests for ServerlessAuthorizationCodeFlow, which prompts
// the user to paste back the OAuth redirect URL instead of running a local server.

import {expect} from 'chai';
import {OAuth2Client} from 'google-auth-library';
import inquirer from 'inquirer';
import {afterEach, describe, it} from 'mocha';
import sinon from 'sinon';
import {ServerlessAuthorizationCodeFlow} from '../../src/auth/serverless_auth_code_flow.js';
import {useChaiExtensions} from '../helpers.js';

useChaiExtensions();

describe('ServerlessAuthorizationCodeFlow', function () {
  afterEach(function () {
    sinon.restore();
  });

  describe('getRedirectUri', function () {
    it('defaults to port 8888 when no port is given', async function () {
      const flow = new ServerlessAuthorizationCodeFlow(new OAuth2Client());
      expect(await flow.getRedirectUri()).to.equal('http://localhost:8888');
    });

    it('uses the given port when provided', async function () {
      const flow = new ServerlessAuthorizationCodeFlow(new OAuth2Client(), 1234);
      expect(await flow.getRedirectUri()).to.equal('http://localhost:1234');
    });
  });

  describe('promptAndReturnCode', function () {
    it('returns the code when the pasted URL has a matching state and no error', async function () {
      sinon.stub(inquirer, 'prompt').resolves({url: 'http://localhost:8888?code=test_code&state=expected_state'});
      const flow = new ServerlessAuthorizationCodeFlow(new OAuth2Client());

      const code = await flow.promptAndReturnCode('http://auth.url', 'expected_state');
      expect(code).to.equal('test_code');
    });

    it('throws when the pasted URL contains an error parameter', async function () {
      sinon.stub(inquirer, 'prompt').resolves({url: 'http://localhost:8888?error=access_denied'});
      const flow = new ServerlessAuthorizationCodeFlow(new OAuth2Client());

      await expect(flow.promptAndReturnCode('http://auth.url', 'expected_state')).to.be.rejectedWith('access_denied');
    });

    it('throws when the state parameter is missing (possible CSRF)', async function () {
      sinon.stub(inquirer, 'prompt').resolves({url: 'http://localhost:8888?code=test_code'});
      const flow = new ServerlessAuthorizationCodeFlow(new OAuth2Client());

      await expect(flow.promptAndReturnCode('http://auth.url', 'expected_state')).to.be.rejectedWith(
        'state parameter mismatch',
      );
    });

    it('throws when the state parameter does not match (possible CSRF)', async function () {
      sinon.stub(inquirer, 'prompt').resolves({url: 'http://localhost:8888?code=test_code&state=wrong_state'});
      const flow = new ServerlessAuthorizationCodeFlow(new OAuth2Client());

      await expect(flow.promptAndReturnCode('http://auth.url', 'expected_state')).to.be.rejectedWith(
        'state parameter mismatch',
      );
    });

    it('throws when the code is missing from the pasted URL', async function () {
      sinon.stub(inquirer, 'prompt').resolves({url: 'http://localhost:8888?state=expected_state'});
      const flow = new ServerlessAuthorizationCodeFlow(new OAuth2Client());

      await expect(flow.promptAndReturnCode('http://auth.url', 'expected_state')).to.be.rejectedWith(
        'Missing code in response URL',
      );
    });
  });
});
