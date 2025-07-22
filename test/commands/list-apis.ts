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

    it('should list apis as json', async function () {
      mockListApis();
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis', '--json']);
      const json = JSON.parse(out.stdout);
      expect(json.enabledApis).to.be.an('array');
      expect(json.enabledApis.length).to.equal(1);
      expect(json.enabledApis[0].name).to.equal('docs');
      expect(json.availableApis).to.be.an('array');
      expect(json.availableApis.length).to.equal(2);
      expect(json.availableApis[0].name).to.equal('docs');
      expect(json.availableApis[1].name).to.equal('gmail');
    });
  });
});
