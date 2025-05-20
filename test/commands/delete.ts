import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {useChaiExtensions} from '../helpers.js';
import {mockOAuthRefreshRequest, mockTrashScript, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';
import sinon from 'sinon';
import inquirer from 'inquirer';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Delete script command', function () {
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

    it('should delete a script', async function () {
      mockTrashScript({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['delete', '-f']);
      expect(out.stdout).to.contain('Deleted script mock-script-id');
    });

    it('should not delete the script if user declines', async function () {
      mockTrashScript({
        scriptId: 'mock-script-id',
      });
      sinon.stub(inquirer, 'prompt').resolves({ answer: false });
      const out = await runCommand(['delete']);
      expect(out.stdout).to.not.contain('Deleted script');
    });

    it('should delete the script if user confirms', async function () {
      mockTrashScript({ scriptId: 'mock-script-id' });
      sinon.stub(inquirer, 'prompt').resolves({ answer: true });
      const out = await runCommand(['delete']);
      expect(out.stdout).to.contain('Deleted script mock-script-id');
    });
  });
});
