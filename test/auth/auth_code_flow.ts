// Copyright 2026 Google LLC
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

// Tests for OAuth 2.0 state parameter generation and CSRF protection.

import {expect} from 'chai';
import {describe, it} from 'mocha';

import {OAuth2Client} from 'google-auth-library';
import sinon from 'sinon';
import {AuthorizationCodeFlow, generateState, parseAuthResponseUrl} from '../../src/auth/auth_code_flow.js';

describe('OAuth state parameter (CSRF protection)', function () {
  describe('generateState', function () {
    it('returns a non-empty string', function () {
      const state = generateState();
      expect(state).to.be.a('string');
      expect(state.length).to.be.greaterThan(0);
    });

    it('generates unique values on successive calls', function () {
      const a = generateState();
      const b = generateState();
      expect(a).to.not.equal(b);
    });

    it('produces URL-safe base64 output', function () {
      const state = generateState();
      // base64url uses only A-Z, a-z, 0-9, '-', '_' with no padding '='
      expect(state).to.match(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('parseAuthResponseUrl', function () {
    it('extracts code, state, and error from a URL', function () {
      const result = parseAuthResponseUrl('http://localhost:12345?code=test_code&state=test_state');
      expect(result.code).to.equal('test_code');
      expect(result.state).to.equal('test_state');
      expect(result.error).to.be.null;
    });

    it('returns null state when the parameter is absent', function () {
      const result = parseAuthResponseUrl('http://localhost:12345?code=test_code');
      expect(result.code).to.equal('test_code');
      expect(result.state).to.be.null;
    });

    it('extracts error when present', function () {
      const result = parseAuthResponseUrl('http://localhost:12345?error=access_denied');
      expect(result.error).to.equal('access_denied');
      expect(result.code).to.be.null;
    });
  });
});

describe('AuthorizationCodeFlow (PKCE implementation)', function () {
  it('should pass code challenge and verifier to OAuth2Client', async function () {
    const oauth2Client = new OAuth2Client();

    const generateCodeVerifierAsyncStub = sinon.stub(oauth2Client, 'generateCodeVerifierAsync').resolves({
      codeVerifier: 'test_verifier',
      codeChallenge: 'test_challenge',
    });
    const generateAuthUrlStub = sinon.stub(oauth2Client, 'generateAuthUrl').returns('http://auth.url');
    const getTokenStub = sinon.stub(oauth2Client, 'getToken').resolves({
      tokens: {access_token: 'test_access_token'},
      res: null,
    });
    const setCredentialsStub = sinon.stub(oauth2Client, 'setCredentials');

    class TestFlow extends AuthorizationCodeFlow {
      async getRedirectUri() {
        return 'http://localhost';
      }
      async promptAndReturnCode(_url: string, _state: string) {
        return 'test_auth_code';
      }
    }

    const flow = new TestFlow(oauth2Client);
    await flow.authorize(['scope1', 'scope2']);

    expect(generateCodeVerifierAsyncStub.calledOnce).to.be.true;

    // Verify generateAuthUrl was called with PKCE params
    const authUrlArgs = generateAuthUrlStub.firstCall.args[0];
    expect(authUrlArgs).to.include({
      code_challenge: 'test_challenge',
      code_challenge_method: 'S256',
    });

    // Verify getToken was called with PKCE verifier
    const getTokenArgs = getTokenStub.firstCall.args[0] as any;
    expect(getTokenArgs).to.include({
      code: 'test_auth_code',
      codeVerifier: 'test_verifier',
    });

    expect(setCredentialsStub.calledOnce).to.be.true;
  });
});
