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

import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockDisableService, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Disable API command', function () {
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
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-services.json')),
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should disable a service in manifest', async function () {
      mockDisableService({
        projectId: 'mock-gcp-project',
        serviceName: 'gmail.googleapis.com',
      });

      const out = await runCommand(['disable-api', 'gmail']);
      expect(out.stdout).to.contain('Disabled gmail API');

      const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
      expect(manifest).to.not.containSubset({
        dependencies: {
          enabledAdvancedServices: [
            {
              serviceId: 'gmail',
            },
          ],
        },
      });
    });

    it('should reject unknown services', async function () {
      const out = await runCommand(['disable-api', 'xyz']);
      expect(out.stderr).to.contain('not a valid');
    });
  });
});
