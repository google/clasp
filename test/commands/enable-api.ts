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
  });
});
