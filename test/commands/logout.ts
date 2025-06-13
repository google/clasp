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

// This file contains tests for the 'logout' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';

import {ClaspTokenStore} from '../../src/auth/store.js'; // For spying on delete
import {useChaiExtensions} from '../helpers.js';
import {resetMocks, setupMocks, mockOAuthRefreshRequest} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Logout command', function () {
  let deleteSpy: sinon.SinonSpy;

  beforeEach(function () {
    setupMocks();
    // Logout doesn't make API calls but interacts with credential store.
    // Spy on ClaspTokenStore.delete method
    deleteSpy = sinon.spy(ClaspTokenStore.prototype, 'delete');
  });

  afterEach(function () {
    deleteSpy.restore();
    resetMocks();
    mockfs.restore();
  });

  describe('When logged in', function () {
    beforeEach(function () {
      // Simulate being logged in by providing a .clasprc.json with credentials
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: JSON.stringify({
          token: {access_token: 'dummy_token', refresh_token: 'dummy_refresh'},
          oauth2ClientSettings: {clientId: 'dummy_client_id', clientSecret: 'dummy_client_secret', redirectUri: 'dummy_redirect_uri'},
          users: {'default': {user:'default', credentials: {access_token: 'dummy_token'}}}
        }),
      });
    });

    it('should logout and print success message for text output', async function () {
      const out = await runCommand(['logout']);
      expect(out.stdout).to.contain('Deleted credentials.');
      expect(deleteSpy.calledOnceWith('default')).to.be.true; // 'default' user
    });

    it('should logout and output JSON', async function () {
      const out = await runCommand(['logout', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({status: 'success'});
      expect(out.stdout).to.not.contain('Deleted credentials.');
      expect(deleteSpy.calledOnceWith('default')).to.be.true;
    });
  });

  describe('When not logged in', function () {
    beforeEach(function () {
      // Simulate not being logged in (e.g., empty or no .clasprc.json)
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: '{}',
      });
    });

    it('should do nothing for text output if already logged out', async function () {
      const out = await runCommand(['logout']);
      expect(out.stdout).to.equal(''); // Command currently prints nothing if not logged in
      expect(deleteSpy.notCalled).to.be.true; // Or called but doesn't find 'default' to delete
    });

    it('should output JSON status success even if already logged out', async function () {
      // The command deletes credentials if they exist. If not, it's still a "successful" logout state.
      const out = await runCommand(['logout', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({status: 'success'});
      expect(deleteSpy.notCalled).to.be.true;
    });
  });
});
