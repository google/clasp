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
import {expect} from 'chai';
import fs from 'fs/promises';
import {describe, it} from 'mocha';
import {initClaspInstance} from '../../src/core/clasp.js';
import {useChaiExtensions} from '../helpers.js';

useChaiExtensions();

async function withTempDir<T>(prefix: string, fn: (tempDir: string) => Promise<T>): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(tempDir);
  } finally {
    await fs.rm(tempDir, {recursive: true, force: true});
  }
}

describe('Clasp core real filesystem behavior', function () {
  it('should fail with a controlled error when --project path does not exist', async function () {
    await withTempDir('clasp-project-path-', async tempDir => {
      const invalidProjectPath = path.join(tempDir, 'missing', '.clasp.json');
      await expect(initClaspInstance({configFile: invalidProjectPath})).to.eventually.be.rejectedWith(
        `Invalid --project path: ${invalidProjectPath}. File or directory does not exist.`,
      );
    });
  });

  it('should fail with a controlled error when --ignore path does not exist', async function () {
    await withTempDir('clasp-ignore-path-', async tempDir => {
      const invalidIgnorePath = path.join(tempDir, 'missing', '.claspignore');
      await expect(initClaspInstance({rootDir: tempDir, ignoreFile: invalidIgnorePath})).to.eventually.be.rejectedWith(
        `Invalid --ignore path: ${invalidIgnorePath}. File or directory does not exist.`,
      );
    });
  });

  it('should surface settings write failures from setProjectId', async function () {
    await withTempDir('clasp-set-project-id-', async tempDir => {
      const missingRootDir = path.join(tempDir, 'missing-root');
      const clasp = await initClaspInstance({rootDir: missingRootDir});
      clasp.withScriptId('mock-script-id');
      await expect(clasp.project.setProjectId('mock-project-id')).to.eventually.be.rejectedWith('ENOENT');
    });
  });
});
