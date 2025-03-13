import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {useChaiExtensions} from '../helpers.js';
import {
  forceInteractiveMode,
  mockDeleteDeployment,
  mockListDeployments,
  mockOAuthRefreshRequest,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Delete deployment command', function () {
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

    it('should delete a deployment', async function () {
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
      });
      const out = await runCommand(['delete-deployment', 'mock-deployment-id']);
      return expect(out.stdout).to.contain('Deleted deployment');
    });

    it('should prompt for deployment', async function () {
      mockListDeployments({scriptId: 'mock-script-id'});
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
      });
      forceInteractiveMode(true);
      sinon.stub(inquirer, 'prompt').resolves({deploymentId: 'mock-deployment-id'});
      const out = await runCommand(['delete-deployment']);
      return expect(out.stdout).to.contain('Deleted deployment');
    });

    it('should delete all if specified', async function () {
      mockListDeployments({scriptId: 'mock-script-id'});
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id',
      });
      mockDeleteDeployment({
        scriptId: 'mock-script-id',
        deploymentId: 'mock-deployment-id-2',
      });
      const out = await runCommand(['delete-deployment', '--all']);
      return expect(out.stdout).to.contain('Deleted all');
    });
  });
});
