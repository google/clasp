import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {use} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {
  forceInteractiveMode,
  mockListScripts,
  mockOAuthRefreshRequest,
  mockScriptDownload,
  mockScriptDownloadError,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

import {chaiFileExists} from '../helpers.js';
use(chaiFileExists);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Clone script command', function () {
  beforeEach(function () {
    setupMocks();
    mockOAuthRefreshRequest();
  });

  afterEach(function () {
    resetMocks();
  });

  describe('With clean dir, authenticated', function () {
    beforeEach(function () {
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should clone a project with scriptId correctly', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'mock-script-id']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should clone a project with script URL correctly', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'https://script.google.com/d/mock-script-id/edit']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should clone a specfic version', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
        version: 2,
      });
      const out = await runCommand(['clone', 'mock-script-id', '2']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should use the provided root directory', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['clone', 'mock-script-id', '--rootDir', 'dist']);
      expect('dist/appsscript.json').to.be.a.realFile;
      expect('dist/Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should prompt if no script provided', async function () {
      mockListScripts();
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      forceInteractiveMode(true); // Force TTY for CI
      sinon.stub(inquirer, 'prompt').resolves({scriptId: 'mock-script-id'});
      const out = await runCommand(['clone']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should give an error if no script and not interactive', async function () {
      forceInteractiveMode(false);
      const out = await runCommand(['clone']);
      return expect(out.stderr).to.contain('No script ID');
    });

    it('should give an error on a non-existing project', async function () {
      mockScriptDownloadError({
        scriptId: 'non-existing-project',
      });
      const out = await runCommand(['clone', 'non-existing-project']);
      return expect(out.stderr).to.contain('Invalid script ID');
    });

    it('should not write .clasp.json if unable to clone', async function () {
      mockScriptDownloadError({
        scriptId: 'mock-script-id',
      });
      await runCommand(['clone', 'mock-script-id']);
      expect('.clasp.json').to.not.be.a.realFile;
    });
  });

  describe('With existing project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should give error if .clasp.json exists', async function () {
      const out = await runCommand(['clone', 'mock-id']);
      return expect(out.stderr).to.contain('already exists');
    });
  });
});
