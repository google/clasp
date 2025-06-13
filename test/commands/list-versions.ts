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

// This file contains tests for the 'list-versions' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockListVersions, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('List versions command', function () {
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

    it('should list scripts', async function () {
      mockListVersions({scriptId: 'mock-script-id'});
      const out = await runCommand(['list-versions']);
      return expect(out.stdout).to.contain('Test version 1');
    });

    it('should list versions in JSON format (chronological order)', async function () {
      mockListVersions({scriptId: 'mock-script-id'}); // Returns v1 then v2
      const out = await runCommand(['list-versions', '--json']);

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      // The command implementation for JSON output reverses the API's order (which is newest first)
      // to output chronological order (oldest first).
      const expectedVersions = [
        {version: 1, description: 'Test version 1'},
        {version: 2, description: 'Test version 2'},
      ];

      expect(jsonResponse.versions).to.be.an('array');
      expect(jsonResponse.versions).to.deep.equal(expectedVersions); // Order matters here

      expect(out.stdout).to.not.contain('Found'); // Text from normal output
    });

    it('should list versions using alias "versions" in JSON format', async function () {
      mockListVersions({scriptId: 'mock-script-id'});
      const out = await runCommand(['versions', '--json']); // Using alias

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      const expectedVersions = [
        {version: 1, description: 'Test version 1'},
        {version: 2, description: 'Test version 2'},
      ];

      expect(jsonResponse.versions).to.deep.equal(expectedVersions);
      expect(out.stdout).to.not.contain('Found');
    });

    it('should output empty array for no versions in JSON format', async function () {
      nock('https://script.googleapis.com')
        .get(`/v1/projects/mock-script-id/versions`)
        .query(true)
        .reply(200, {versions: []}); // Mock empty list

      const out = await runCommand(['list-versions', '--json']);

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse).to.deep.equal({versions: []});
      // The command would call this.error() for no versions in non-JSON mode.
      // For JSON mode, it should still output the empty array.
      expect(out.stderr).to.equal(''); // No error output expected
    });
  });
});
