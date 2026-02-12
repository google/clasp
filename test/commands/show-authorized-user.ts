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
import {DEFAULT_CLASP_OAUTH_CLIENT_ID} from '../../src/auth/oauth_client.js';
import {useChaiExtensions} from '../helpers.js';
import {mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Show authorized user command', function () {
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  describe('With project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should show the authorized user as json', async function () {
      const out = await runCommand(['show-authorized-user', '--json']);
      const json = JSON.parse(out.stdout);
      expect(json.loggedIn).to.be.true;
      expect(json.clientId).to.equal(DEFAULT_CLASP_OAUTH_CLIENT_ID);
      expect(json.clientType).to.equal('google-provided');
    });

    it('should show the oauth client id in text output', async function () {
      const out = await runCommand(['show-authorized-user']);
      expect(out.stdout).to.contain(`OAuth client ID: ${DEFAULT_CLASP_OAUTH_CLIENT_ID} (google-provided).`);
    });
  });

  describe('With project, authenticated with user-provided client', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated-custom-client.json'),
        ),
      });
    });

    it('should classify the oauth client as user-provided', async function () {
      const out = await runCommand(['show-authorized-user', '--json']);
      const json = JSON.parse(out.stdout);
      expect(json.loggedIn).to.be.true;
      expect(json.clientType).to.equal('user-provided');
    });
  });
});
