import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {use} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {mockDisableService, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

import {chaiFileExists} from '../helpers.js';
use(chaiFileExists);

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
      expect(out.stdout).to.contain('not a valid');
    });
  });
});
