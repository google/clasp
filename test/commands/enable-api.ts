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

// This file contains tests for the 'enable-api' command.

import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockEnableService, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Enable API command', function () {
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

    it('should emsable a service in manifest', async function () {
      mockEnableService({
        projectId: 'mock-gcp-project',
        serviceName: 'docs.googleapis.com',
      });

      const out = await runCommand(['enable-api', 'docs']);
      expect(out.stdout).to.contain('Enabled docs API');

      const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
      expect(manifest).to.containSubset({
        dependencies: {
          enabledAdvancedServices: [
            {
              serviceId: 'docs',
            },
          ],
        },
      });
    });

    it('should reject unknown services', async function () {
      const out = await runCommand(['enable-api', 'xyz']);
      expect(out.stderr).to.contain('not a valid');
    });

    it('should enable a service in manifest and output JSON', async function () {
      const serviceToEnable = 'docs';
      const fullServiceName = `${serviceToEnable}.googleapis.com`;
      mockEnableService({
        projectId: 'mock-gcp-project',
        serviceName: fullServiceName,
      });

      const out = await runCommand(['enable-api', serviceToEnable, '--json']);
      expect(() => JSON.parse(out.stdout)).to.not.throw();
      const jsonResponse = JSON.parse(out.stdout);
      expect(jsonResponse).to.deep.equal({enabledApi: serviceToEnable});

      expect(out.stdout).to.not.contain(`Enabled ${serviceToEnable} API`);

      const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
      // This check assumes 'docs' was not already in the fixture's enabledAdvancedServices.
      // If the fixture already contains it, this check needs adjustment or a different service.
      // The fixture appsscript-services.json has "gmail" and "drive". So "docs" is new.
      expect(manifest.dependencies.enabledAdvancedServices).to.deep.include({
        userSymbol: 'Docs', // The command adds userSymbol based on serviceId
        serviceId: serviceToEnable,
        version: 'v1', // The command adds a default version, typically v1
      });
    });
  });
});
