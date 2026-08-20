// Copyright 2026 Google LLC
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

// Tests for credential file permission hardening.

import fs from 'fs';
import os from 'os';
import path from 'path';
import {expect} from 'chai';
import {afterEach, describe, it} from 'mocha';

import {FileCredentialStore} from '../../src/auth/file_credential_store.js';

describe('FileCredentialStore permissions', function () {
  let tmpFile: string;

  afterEach(function () {
    try {
      fs.unlinkSync(tmpFile);
    } catch (_e) {
      // ignore
    }
  });

  it('creates new credential files with 0600 permissions', async function () {
    if (process.platform === 'win32') {
      return this.skip();
    }
    tmpFile = path.join(os.tmpdir(), `clasprc-test-new-${Date.now()}.json`);
    const store = new FileCredentialStore(tmpFile);
    await store.save('default', {
      type: 'authorized_user',
      access_token: 'test-token',
      refresh_token: 'test-refresh',
    });
    const stat = fs.statSync(tmpFile);
    const mode = stat.mode & 0o777;
    expect(mode).to.equal(0o600);
  });

  it('tightens permissions on an existing file with 0644', async function () {
    if (process.platform === 'win32') {
      return this.skip();
    }
    tmpFile = path.join(os.tmpdir(), `clasprc-test-existing-${Date.now()}.json`);
    // Simulate an old file written with default (world-readable) permissions.
    fs.writeFileSync(tmpFile, '{}', {mode: 0o644});
    const beforeStat = fs.statSync(tmpFile);
    expect(beforeStat.mode & 0o777).to.equal(0o644);

    const store = new FileCredentialStore(tmpFile);
    await store.save('default', {
      type: 'authorized_user',
      access_token: 'test-token',
      refresh_token: 'test-refresh',
    });
    const afterStat = fs.statSync(tmpFile);
    const mode = afterStat.mode & 0o777;
    expect(mode).to.equal(0o600);
  });

  it('rejects saving credentials if the credential file is a symlink by default', async function () {
    if (process.platform === 'win32') {
      return this.skip();
    }
    const realTarget = path.join(os.tmpdir(), `clasprc-target-${Date.now()}.json`);
    tmpFile = path.join(os.tmpdir(), `clasprc-symlink-${Date.now()}.json`);
    fs.writeFileSync(realTarget, '{}', {mode: 0o600});
    fs.symlinkSync(realTarget, tmpFile);

    try {
      const store = new FileCredentialStore(tmpFile);
      let error: Error | undefined;
      try {
        await store.save('default', {
          type: 'authorized_user',
          access_token: 'test-token',
          refresh_token: 'test-refresh',
        });
      } catch (err: any) {
        error = err;
      }
      expect(error).to.be.an.instanceOf(Error);
      expect(error?.message).to.include('Security Error: Credential file is a symlink');
    } finally {
      try {
        fs.unlinkSync(realTarget);
      } catch (_e) {
        // ignore
      }
    }
  });

  it('allows saving credentials to a symlink when allowSymlinks is true', async function () {
    if (process.platform === 'win32') {
      return this.skip();
    }
    const realTarget = path.join(os.tmpdir(), `clasprc-target-allowed-${Date.now()}.json`);
    tmpFile = path.join(os.tmpdir(), `clasprc-symlink-allowed-${Date.now()}.json`);
    fs.writeFileSync(realTarget, '{}', {mode: 0o600});
    fs.symlinkSync(realTarget, tmpFile);

    try {
      const store = new FileCredentialStore(tmpFile, true);
      await store.save('default', {
        type: 'authorized_user',
        access_token: 'test-token',
        refresh_token: 'test-refresh',
      });
      const content = JSON.parse(fs.readFileSync(realTarget, 'utf8'));
      expect(content.tokens?.default?.access_token).to.equal('test-token');
    } finally {
      try {
        fs.unlinkSync(realTarget);
      } catch (_e) {
        // ignore
      }
    }
  });
});
