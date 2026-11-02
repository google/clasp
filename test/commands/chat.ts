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

// This file contains tests for the 'chat' command.

import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import nock from 'nock';
import {mergeManifestDefaults, prepareChatAppConfigPayload} from '../../src/core/chat.js';
import {useChaiExtensions} from '../helpers.js';
import {mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Chat command', function () {
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  describe('Core helpers', function () {
    it('should merge addOns.common defaults from appsscript.json when missing', function () {
      const merged = mergeManifestDefaults(
        {description: 'Chat bot description'},
        {
          addOns: {
            common: {
              name: 'Manifest Add-on Name',
              logoUrl: 'https://example.com/logo.png',
            },
            chat: {
              chatAddon: true,
            },
          },
        },
      );
      expect(merged.displayName).to.equal('Manifest Add-on Name');
      expect(merged.avatarUri).to.equal('https://example.com/logo.png');
      expect(merged.description).to.equal('Chat bot description');
    });

    it('should strip output-only fields and populate name in PATCH payload', function () {
      const payload = prepareChatAppConfigPayload('mock-gcp-project', {
        displayName: 'My Chat Bot',
        description: 'Desc',
        createTime: '2026-10-01T00:00:00Z',
        updateTime: '2026-10-02T00:00:00Z',
        etag: 'abc123',
      });
      expect(payload).to.deep.equal({
        name: 'projects/mock-gcp-project/chatAppConfig',
        displayName: 'My Chat Bot',
        description: 'Desc',
      });
    });
  });

  describe('With project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        'appsscript.json': JSON.stringify({
          timeZone: 'America/Los_Angeles',
          addOns: {
            common: {
              name: 'Manifest Bot',
              logoUrl: 'https://example.com/avatar.png',
            },
            chat: {
              chatAddon: true,
            },
          },
        }),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should get Chat app configuration', async function () {
      nock('https://gsuiteaddons.googleapis.com')
        .get('/v1/projects/mock-gcp-project/chatAppConfig')
        .query({view: 'FULL'})
        .reply(200, {
          name: 'projects/mock-gcp-project/chatAppConfig',
          displayName: 'Test Chat App',
          description: 'Test description',
          state: 'ACTIVE',
        });

      const out = await runCommand(['chat', 'get']);
      const parsed = JSON.parse(out.stdout);
      expect(parsed.displayName).to.equal('Test Chat App');
      expect(parsed.state).to.equal('ACTIVE');
    });

    it('should pull Chat app configuration to chatapp.json', async function () {
      nock('https://gsuiteaddons.googleapis.com')
        .get('/v1/projects/mock-gcp-project/chatAppConfig')
        .query({view: 'FULL'})
        .reply(200, {
          name: 'projects/mock-gcp-project/chatAppConfig',
          displayName: 'Pulled Chat App',
          description: 'Pulled description',
          createTime: '2026-10-01T00:00:00Z',
          etag: 'etag-1',
        });

      const out = await runCommand(['chat', 'pull']);
      expect(out.stdout).to.contain('Pulled Chat app configuration');

      const saved = JSON.parse(fs.readFileSync('chatapp.json', 'utf8'));
      expect(saved.displayName).to.equal('Pulled Chat App');
      expect(saved.createTime).to.be.undefined;
      expect(saved.etag).to.be.undefined;
    });

    it('should push chatapp.json with appsscript.json addOns.common fallback', async function () {
      fs.writeFileSync(
        'chatapp.json',
        JSON.stringify({
          description: 'Updated description',
          state: 'ACTIVE',
        }),
      );

      let capturedBody: Record<string, unknown> | undefined;
      nock('https://gsuiteaddons.googleapis.com')
        .patch('/v1/projects/mock-gcp-project/chatAppConfig', body => {
          capturedBody = body as Record<string, unknown>;
          return true;
        })
        .reply(200, {
          name: 'projects/mock-gcp-project/chatAppConfig',
          displayName: 'Manifest Bot',
          avatarUri: 'https://example.com/avatar.png',
          description: 'Updated description',
          state: 'ACTIVE',
        });

      const out = await runCommand(['chat', 'push']);
      expect(out.stdout).to.contain('Updated Chat app configuration.');
      expect(capturedBody).to.deep.equal({
        name: 'projects/mock-gcp-project/chatAppConfig',
        displayName: 'Manifest Bot',
        avatarUri: 'https://example.com/avatar.png',
        description: 'Updated description',
        state: 'ACTIVE',
      });
    });

    it('should open the Chat API configuration console URL as json', async function () {
      const out = await runCommand(['chat', 'open', '--json']);
      expect(out.stdout).to.contain(
        'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=mock-gcp-project',
      );
    });
  });
});
