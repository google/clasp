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

// This file contains tests for the 'login' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it, Done} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';

import * as auth from '../../src/auth/auth.js'; // To mock auth functions
import {ClaspTokenStore} from '../../src/auth/store.js';
import {useChaiExtensions} from '../helpers.js';
import {resetMocks, setupMocks} from '../mocks.js'; // Assuming these don't mock auth functions heavily themselves
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Login command', function () {
  let authorizeStub: sinon.SinonStub;
  let getUserInfoStub: sinon.SinonStub;
  let getUnauthorizedOuth2ClientStub: sinon.SinonStub;
  let consoleErrorSpy: sinon.SinonSpy;

  beforeEach(function () {
    setupMocks(); // Basic nock, mockfs, env setup
    // We need to mock specific auth functions from 'src/auth/auth.js'
    // runCommand will internally call the login command, which uses these.
    getUnauthorizedOuth2ClientStub = sinon.stub(auth, 'getUnauthorizedOuth2Client').returns({
      generateAuthUrl: sinon.stub().returns('mock-auth-url'),
      getToken: sinon.stub().resolves({tokens: {access_token: 'mock-access-token'}}),
    } as any);

    authorizeStub = sinon.stub(auth, 'authorize').resolves({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      scope: 'mock_scope',
      token_type: 'Bearer',
      expiry_date: Date.now() + 3600000,
    });

    getUserInfoStub = sinon.stub(auth, 'getUserInfo').resolves({
      email: 'mock.user@example.com',
      name: 'Mock User',
      given_name: 'Mock',
      family_name: 'User',
      picture: '',
      locale: 'en',
      hd: '',
    });

    consoleErrorSpy = sinon.spy(console, 'error');

    // Mock a minimal .clasprc.json for credential storage
    // The login command itself doesn't read .clasp.json
    mockfs({
      [path.resolve(os.homedir(), '.clasprc.json')]: '{}', // Empty store initially
    });
  });

  afterEach(function () {
    authorizeStub.restore();
    getUserInfoStub.restore();
    getUnauthorizedOuth2ClientStub.restore();
    consoleErrorSpy.restore();
    resetMocks(); // Restore nock, mockfs, env
    mockfs.restore();
  });

  it('should login and print success message for text output', async function () {
    const out = await runCommand(['login', '--no-localhost']); // --no-localhost to avoid local server in tests
    expect(out.stdout).to.contain('You are logged in as mock.user@example.com.');
    expect(authorizeStub.calledOnce).to.be.true;
    expect(getUserInfoStub.calledOnce).to.be.true;
    // Check if credentials were saved (simplified check)
    const rcFileContent = mockfs.readFileSync(path.resolve(os.homedir(), '.clasprc.json'), {encoding: 'utf8'});
    expect(rcFileContent).to.contain('mock_access_token');
  });

  it('should login and output JSON', async function () {
    const out = await runCommand(['login', '--no-localhost', '--json']);
    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({email: 'mock.user@example.com'});
    expect(out.stdout).to.not.contain('You are logged in as');
    expect(authorizeStub.calledOnce).to.be.true;
    expect(getUserInfoStub.calledOnce).to.be.true;
  });

  it('should warn if already logged in (text output)', async function () {
    // Simulate already logged in by making authorize return existing creds
    // For this test, more direct mocking of AuthInfo passed to the command might be needed,
    // or pre-populate .clasprc.json and ensure `new Auth()` inside `initAuth` picks it up.
    // The command's "already logged in" check is `if (auth.credentials)`.
    // `initAuth` in `program.ts` loads this.
    // Let's pre-populate .clasprc.json for this test.
     mockfs({
      [path.resolve(os.homedir(), '.clasprc.json')]: JSON.stringify({
        token: {access_token: 'prev_token'},
        oauth2ClientSettings: {},
        users: {'default': {user: 'default', credentials: {access_token: 'prev_token'}}}
      }),
    });

    await runCommand(['login', '--no-localhost']); // Output can be checked via consoleErrorSpy
    // The command logs a warning then proceeds to log in again.
    expect(consoleErrorSpy.calledWith(sinon.match.string)).to.be.true;
    expect(consoleErrorSpy.getCall(0).args[0]).to.contain('Warning: You seem to already be logged in.');
    // It will then print the successful login message:
    // This assertion might be tricky if runCommand only captures stdout not stderr for warnings
    // The runCommand utility might need adjustment or this check needs to be on combined output.
    // For now, focusing on the warning.
  });

   it('should warn if already logged in and still output JSON', async function () {
    mockfs({
      [path.resolve(os.homedir(), '.clasprc.json')]: JSON.stringify({
        token: {access_token: 'prev_token'},
        oauth2ClientSettings: {},
        users: {'default': {user: 'default', credentials: {access_token: 'prev_token'}}}
      }),
    });

    const out = await runCommand(['login', '--no-localhost', '--json']);
    expect(consoleErrorSpy.calledWith(sinon.match.string)).to.be.true;
    expect(consoleErrorSpy.getCall(0).args[0]).to.contain('Warning: You seem to already be logged in.');

    expect(() => JSON.parse(out.stdout)).to.not.throw();
    const jsonResponse = JSON.parse(out.stdout);
    expect(jsonResponse).to.deep.equal({email: 'mock.user@example.com'});
   });
});
