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

// This file contains tests for the 'list-apis' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockListApis, mockListEnabledServices, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('List APIs command', function () {
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
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should list enabled APIs', async function () {
      mockListApis();
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis']);
      return expect(out.stdout).to.contain('# Currently enabled APIs:\ndocs');
    });

    it('should list available APIs', async function () {
      mockListApis();
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis']);
      return expect(out.stdout).to.contain('gmail');
    });

    it('should hide non-advanced services', async function () {
      mockListApis();
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis']);
      return expect(out.stdout).to.not.contain('ignored');
    });

    it('should list enabled and available APIs in JSON format', async function () {
      mockListApis(); // Provides 'docs', 'gmail', 'ignored'
      mockListEnabledServices({ // Enables 'docs.googleapis.com'
        projectId: 'mock-gcp-project',
      });

      const out = await runCommand(['list-apis', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      // Based on mocks: 'docs' is enabled. 'docs' and 'gmail' are available (ignored is filtered).
      const expectedEnabledApis = [
        {name: 'docs', description: 'Reads and writes Google Docs documents.'},
      ];
      const expectedAvailableApis = [
        {name: 'docs', description: 'Reads and writes Google Docs documents.'},
        {name: 'gmail', description: 'The Gmail API lets you view and manage Gmail mailbox data like threads, messages, and labels.'},
      ];

      expect(jsonResponse.enabledApis).to.deep.members(expectedEnabledApis);
      expect(jsonResponse.enabledApis.length).to.equal(expectedEnabledApis.length);
      expect(jsonResponse.availableApis).to.deep.members(expectedAvailableApis);
      expect(jsonResponse.availableApis.length).to.equal(expectedAvailableApis.length);

      expect(out.stdout).to.not.contain('# Currently enabled APIs:');
      expect(out.stdout).to.not.contain('# List of available APIs:');
    });
  });
});
