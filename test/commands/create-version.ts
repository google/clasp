import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {use} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {forceInteractiveMode, mockCreateVersion, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

import {chaiFileExists} from '../helpers.js';
use(chaiFileExists);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Create version command', function () {
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

    it('should create version and prompt for description when not set', async function () {
      mockCreateVersion({
        scriptId: 'mock-script-id',
        description: 'test version',
        version: 1,
      });
      forceInteractiveMode(true);
      sinon.stub(inquirer, 'prompt').resolves({description: 'test version'});
      const out = await runCommand(['create-version']);
      return expect(out.stdout).to.contain('Created version');
    });

    it('should use provided description', async function () {
      mockCreateVersion({
        scriptId: 'mock-script-id',
        description: 'test',
        version: 1,
      });
      const out = await runCommand(['create-version', 'test']);
      return expect(out.stdout).to.contain('Created version');
    });
  });
});
