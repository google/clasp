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

// This file contains tests for the 'add-library' command.

import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Add library command', function () {
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
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should add a library to the manifest', async function () {
      const out = await runCommand(['add-library', 'mock-library-id', '--libraryVersion', '3', '--symbol', 'MyLib']);
      expect(out.stdout).to.contain('Added library MyLib');

      const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
      expect(manifest).to.containSubset({
        dependencies: {
          libraries: [
            {
              userSymbol: 'MyLib',
              libraryId: 'mock-library-id',
              version: '3',
              developmentMode: false,
            },
          ],
        },
      });
    });

    it('should update an existing library with the same id', async function () {
      await runCommand(['add-library', 'mock-library-id', '--libraryVersion', '1', '--symbol', 'MyLib']);
      await runCommand(['add-library', 'mock-library-id', '--libraryVersion', '2', '--symbol', 'MyLib']);

      const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
      const libraries = manifest.dependencies.libraries;
      expect(libraries).to.have.lengthOf(1);
      expect(libraries[0].version).to.equal('2');
    });

    it('should add a library as json', async function () {
      const out = await runCommand([
        'add-library',
        'mock-library-id',
        '--libraryVersion',
        '3',
        '--symbol',
        'MyLib',
        '--json',
      ]);
      const json = JSON.parse(out.stdout);
      expect(json.success).to.be.true;
      expect(json.libraryId).to.equal('mock-library-id');
    });
  });
});
