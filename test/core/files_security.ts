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

import os from 'os';
import path from 'path';
import fs from 'fs';

import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import nock from 'nock';
import {initClaspInstance} from '../../src/core/clasp.js';
import {useChaiExtensions} from '../helpers.js';
import {resetMocks, setupMocks} from '../mocks.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mockCredentials() {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: 'mock-access-token',
  });
  return client;
}

describe('File operations security', function () {
  beforeEach(function () {
    setupMocks();
  });

  afterEach(function () {
    resetMocks();
    mockfs.restore();
  });

  describe('Path Traversal & Symlink Protections', function () {
    beforeEach(function () {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should throw Security Error if remote file name attempts path traversal outside contentDir', async function () {
      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: '../traversal-file',
              type: 'SERVER_JS',
              source: 'function exploit() {}',
            },
          ],
        });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      await expect(clasp.files.pull()).to.eventually.be.rejectedWith(
        'Security Error: Remote file name "../traversal-file" attempts to write outside the project directory.',
      );
    });

    it('should throw Security Error if contentDir is a symlink', async function () {
      mockfs.restore(); // Restore to customize filesystem structure
      mockfs({
        '.clasp.json': JSON.stringify({
          scriptId: 'mock-script-id',
          rootDir: 'dist',
        }),
        'real_dist': {
          'appsscript.json': '{}',
        },
        'dist': mockfs.symlink({
          path: 'real_dist',
        }),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function test() {}',
            },
          ],
        });

      await expect(clasp.files.pull()).to.eventually.be.rejectedWith(
        'Security Error: Content directory is a symlink. Possible race attack.',
      );
    });

    it('should skip writing file if a parent directory is a symbolic link pointing outside contentDir', async function () {
      mockfs.restore();
      mockfs({
        'appsscript.json': '{}',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'outside_dir': {},
        'subdir': mockfs.symlink({
          path: 'outside_dir',
        }),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'subdir/exploit',
              type: 'SERVER_JS',
              source: 'function malicious() {}',
            },
          ],
        });

      const {writeResult} = await clasp.files.pull();
      // Verify file wasn't written to the outside directory
      expect(fs.existsSync('outside_dir/exploit.js')).to.be.false;
      expect(writeResult.skipped).to.have.deep.members([
        {localPath: 'subdir/exploit.js', reason: 'parent_symlink'},
      ]);
    });

    it('should skip writing file if the target path is a symbolic link', async function () {
      mockfs.restore();
      mockfs({
        'appsscript.json': '{}',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'outside_file.js': '// original content',
        'Code.js': mockfs.symlink({
          path: 'outside_file.js',
        }),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function overwrite() {}',
            },
          ],
        });

      const {writeResult} = await clasp.files.pull();
      // Verify the target of the symlink was not overwritten
      expect(fs.readFileSync('outside_file.js', 'utf8')).to.equal('// original content');
      expect(writeResult.skipped).to.have.deep.members([
        {localPath: 'Code.js', reason: 'target_symlink'},
      ]);
    });

    it('should successfully overwrite normal, pre-existing local files', async function () {
      mockfs.restore();
      mockfs({
        'appsscript.json': '{}',
        'Code.js': 'function original() {}',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      nock('https://script.googleapis.com')
        .get(/\/v1\/projects\/.*\/content/)
        .reply(200, {
          scriptId: 'mock-script-id',
          files: [
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: 'function updated() {}',
            },
          ],
        });

      const {writeResult} = await clasp.files.pull();
      expect(fs.readFileSync('Code.js', 'utf8')).to.equal('function updated() {}');
      expect(writeResult.written).to.have.deep.members(['Code.js']);
      expect(writeResult.skipped).to.be.empty;
    });

    it('should skip collecting files if the file is a symbolic link', async function () {
      mockfs.restore();
      mockfs({
        'appsscript.json': '{}',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'outside_file.js': 'function exploit() {}',
        'Code.js': mockfs.symlink({
          path: 'outside_file.js',
        }),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      const {files, skipped} = await clasp.files.collectLocalFiles();
      expect(files.map(f => f.localPath)).to.not.include('Code.js');
      expect(skipped).to.have.deep.members([
        {localPath: 'Code.js', reason: 'symlink'},
      ]);
    });

    it('should skip collecting files if a parent directory is a symbolic link', async function () {
      mockfs.restore();
      mockfs({
        'appsscript.json': '{}',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'outside_dir': {
          'Code.js': 'function exploit() {}',
        },
        'subdir': mockfs.symlink({
          path: 'outside_dir',
        }),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      const {files} = await clasp.files.collectLocalFiles();
      expect(files.map(f => f.localPath)).to.not.include('subdir/Code.js');
    });

    it('should throw Security Error if contentDir is a symlink when collecting files', async function () {
      mockfs.restore();
      mockfs({
        '.clasp.json': JSON.stringify({
          scriptId: 'mock-script-id',
          rootDir: 'dist',
        }),
        'real_dist': {
          'appsscript.json': '{}',
        },
        'dist': mockfs.symlink({
          path: 'real_dist',
        }),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });

      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });

      await expect(clasp.files.collectLocalFiles()).to.eventually.be.rejectedWith(
        'Security Error: Content directory is a symlink. Possible race attack.',
      );
    });
  });
});
