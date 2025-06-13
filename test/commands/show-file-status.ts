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

// This file contains tests for the 'show-file-status' (alias 'status') command.

import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {runCommand} from './utils.js'; // Assuming this path is correct from context
import {Files, ProjectFile} from '../../src/core/files.js'; // Adjust path as needed
import {mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js'; // Adjust path
import {useChaiExtensions} from '../helpers.js'; // Adjust path

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Show file status command (status)', function () {
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest(); // If status command potentially involves auth checks indirectly
  });

  afterEach(function () {
    resetMocks();
    mockfs.restore(); // Ensure mock-fs is restored
  });

  describe('With project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')), // Adjusted path
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'), // Adjusted path
        ),
      });
    });

    const mockFilesToPush: ProjectFile[] = [
      {name: 'file1', type: 'SERVER_JS', source: '', localPath: 'file1.js'},
      {name: 'file2', type: 'HTML', source: '', localPath: 'file2.html'},
    ];
    const mockUntrackedFiles: string[] = ['untracked.gs', 'another/untracked.ts'];

    it('should print status in text form correctly', async function () {
      const collectLocalFilesStub = sinon.stub(Files.prototype, 'collectLocalFiles').resolves(mockFilesToPush);
      const getUntrackedFilesStub = sinon.stub(Files.prototype, 'getUntrackedFiles').resolves(mockUntrackedFiles);

      const out = await runCommand(['show-file-status']);

      expect(out.stdout).to.contain('Tracked files:');
      for (const file of mockFilesToPush) {
        expect(out.stdout).to.contain(`└─ ${file.localPath}`);
      }
      expect(out.stdout).to.contain('Untracked files:');
      for (const file of mockUntrackedFiles) {
        expect(out.stdout).to.contain(`└─ ${file}`);
      }

      collectLocalFilesStub.restore();
      getUntrackedFilesStub.restore();
    });

    it('should print status in JSON form correctly', async function () {
      const collectLocalFilesStub = sinon.stub(Files.prototype, 'collectLocalFiles').resolves(mockFilesToPush);
      const getUntrackedFilesStub = sinon.stub(Files.prototype, 'getUntrackedFiles').resolves(mockUntrackedFiles);

      const out = await runCommand(['show-file-status', '--json']);

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse).to.deep.equal({
        filesToPush: mockFilesToPush.map(f => f.localPath),
        untrackedFiles: mockUntrackedFiles,
      });
      expect(out.stdout).to.not.contain('Tracked files:');
      expect(out.stdout).to.not.contain('Untracked files:');

      collectLocalFilesStub.restore();
      getUntrackedFilesStub.restore();
    });

    it('should handle no files for text output', async function () {
      const collectLocalFilesStub = sinon.stub(Files.prototype, 'collectLocalFiles').resolves([]);
      const getUntrackedFilesStub = sinon.stub(Files.prototype, 'getUntrackedFiles').resolves([]);

      const out = await runCommand(['show-file-status']);

      expect(out.stdout).to.contain('Tracked files:');
      expect(out.stdout).to.contain('Untracked files:');
      // Check that no files are listed under these headers.
      // This might involve checking that lines following headers are not file lines,
      // or simply that the specific mock file paths are not present.
      expect(out.stdout).to.not.contain(`└─ ${mockFilesToPush[0].localPath}`);


      collectLocalFilesStub.restore();
      getUntrackedFilesStub.restore();
    });

    it('should handle no files for JSON output', async function () {
      const collectLocalFilesStub = sinon.stub(Files.prototype, 'collectLocalFiles').resolves([]);
      const getUntrackedFilesStub = sinon.stub(Files.prototype, 'getUntrackedFiles').resolves([]);

      const out = await runCommand(['show-file-status', '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse).to.deep.equal({
        filesToPush: [],
        untrackedFiles: [],
      });

      collectLocalFilesStub.restore();
      getUntrackedFilesStub.restore();
    });
     it('should use alias "status" for text output', async function () {
      const collectLocalFilesStub = sinon.stub(Files.prototype, 'collectLocalFiles').resolves(mockFilesToPush);
      const getUntrackedFilesStub = sinon.stub(Files.prototype, 'getUntrackedFiles').resolves(mockUntrackedFiles);

      const out = await runCommand(['status']); // Using alias

      expect(out.stdout).to.contain('Tracked files:');
      for (const file of mockFilesToPush) {
        expect(out.stdout).to.contain(`└─ ${file.localPath}`);
      }
      expect(out.stdout).to.contain('Untracked files:');
      for (const file of mockUntrackedFiles) {
        expect(out.stdout).to.contain(`└─ ${file}`);
      }

      collectLocalFilesStub.restore();
      getUntrackedFilesStub.restore();
    });

    it('should use alias "status" for JSON output', async function () {
      const collectLocalFilesStub = sinon.stub(Files.prototype, 'collectLocalFiles').resolves(mockFilesToPush);
      const getUntrackedFilesStub = sinon.stub(Files.prototype, 'getUntrackedFiles').resolves(mockUntrackedFiles);

      const out = await runCommand(['status', '--json']); // Using alias

      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);

      expect(jsonResponse).to.deep.equal({
        filesToPush: mockFilesToPush.map(f => f.localPath),
        untrackedFiles: mockUntrackedFiles,
      });

      collectLocalFilesStub.restore();
      getUntrackedFilesStub.restore();
    });
  });
});
