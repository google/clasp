import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {
  mockCreateDeployment,
  mockCreateVersion,
  mockOAuthRefreshRequest,
  mockUpdateDeployment,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';
import { useChaiExtensions } from '../helpers.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Create deployment command', function () {
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
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should create version and use default description', async function () {
      mockCreateVersion({
        scriptId: 'mock-script-id',
        version: 1,
      });
      mockCreateDeployment({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['deploy']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @1');
    });

    it('should use provided version id', async function () {
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        version: 2,
      });
      const out = await runCommand(['deploy', '-V', '2']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @2');
    });

    it('should use provided description', async function () {
      mockCreateVersion({
        scriptId: 'mock-script-id',
        description: 'test',
        version: 1,
      });
      mockCreateDeployment({
        scriptId: 'mock-script-id',
        description: 'test',
      });
      const out = await runCommand(['deploy', '-d', 'test']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @1');
    });

    it('should update existing deployment', async function () {
      mockUpdateDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
        version: 2,
      });
      const out = await runCommand(['deploy', '-i', 'mock-deployment-id', '-V', '2']);
      return expect(out.stdout).to.contain('Deployed mock-deployment-id @2');
    });
  });
});
