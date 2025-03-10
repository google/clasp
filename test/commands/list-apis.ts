import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {use} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {mockListApis, mockListEnabledServices, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

import {chaiFileExists} from '../helpers.js';
use(chaiFileExists);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('List APIs command', function () {
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
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should list enabled APIs', async function () {
      mockListApis();
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis']);
      return expect(out.stdout).to.contain('# Currently enabled APIs:\ndocs');
    });

    it('should list available APIs', async function () {
      mockListApis();
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis']);
      return expect(out.stdout).to.contain('gmail');
    });

    it('should hide non-advanced services', async function () {
      mockListApis();
      mockListEnabledServices({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['list-apis']);
      return expect(out.stdout).to.not.contain('ignored');
    });

  });
});
