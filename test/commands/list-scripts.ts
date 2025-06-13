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

// This file contains tests for the 'list-scripts' command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockListScripts, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('List scripts command', function () {
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
      mockListScripts();
      const out = await runCommand(['list-scripts']);
      return expect(out.stdout).to.contain('script 1');
    });

    it('should list scripts in JSON format', async function () {
      mockListScripts(); // Mocks 3 scripts by default
      const out = await runCommand(['list-scripts', '--json']);

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      const expectedScripts = [
        {name: 'script 1', url: 'https://script.google.com/d/id1/edit'},
        {name: 'script 2', url: 'https://script.google.com/d/id2/edit'},
        {name: 'script 3', url: 'https://script.google.com/d/id3/edit'},
      ];

      expect(jsonResponse.scripts).to.be.an('array');
      expect(jsonResponse.scripts).to.deep.members(expectedScripts);
      expect(jsonResponse.scripts.length).to.equal(expectedScripts.length);

      expect(out.stdout).to.not.contain('Found'); // Text from normal output
    });

    it('should list scripts using alias "list" in JSON format', async function () {
      mockListScripts();
      const out = await runCommand(['list', '--json']); // Using alias

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      const expectedScripts = [
        {name: 'script 1', url: 'https://script.google.com/d/id1/edit'},
        {name: 'script 2', url: 'https://script.google.com/d/id2/edit'},
        {name: 'script 3', url: 'https://script.google.com/d/id3/edit'},
      ];

      expect(jsonResponse.scripts).to.deep.members(expectedScripts);
      expect(jsonResponse.scripts.length).to.equal(expectedScripts.length);
      expect(out.stdout).to.not.contain('Found');
    });

    it('should output empty array for no scripts in JSON format', async function () {
      nock('https://www.googleapis.com')
        .get('/drive/v3/files')
        .query(true)
        .reply(200, {files: []}); // Mock empty list

      const out = await runCommand(['list-scripts', '--json']);

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse).to.deep.equal({scripts: []});
      expect(out.stdout).to.not.contain('No script files found.');
    });
  });
});
