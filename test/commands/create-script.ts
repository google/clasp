import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {use} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {
  mockCreateBoundScript,
  mockCreateScript,
  mockOAuthRefreshRequest,
  mockScriptDownload,
  resetMocks,
  setupMocks,
} from '../mocks.js';
import {runCommand} from './utils.js';

import {getDefaultProjectName} from '../../src/commands/create-script.js';

import {chaiFileExists} from '../helpers.js';
use(chaiFileExists);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Create script command', function () {
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
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should create a version', async function () {
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: getDefaultProjectName(process.cwd()),
      });

      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should create a bound script', async function () {
      mockCreateBoundScript({
        scriptId: 'mock-script-id',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        title: 'test sheet',
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--type', 'sheets', '--title', 'test sheet']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should create a standalone script with given title', async function () {
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: 'test',
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--title', 'test']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
    });

    it('should use the given root directory', async function () {
      mockCreateScript({
        scriptId: 'mock-script-id',
        title: 'test',
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['create', '--title', 'test', '--rootDir', 'dist']);
      expect('dist/appsscript.json').to.be.a.realFile;
      expect('dist/Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Cloned');
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

    afterEach(function () {
      mockfs.restore();
      sinon.restore();
    });

    it('should give error if .clasp.json exists', async function () {
      const out = await runCommand(['create']);
      return expect(out.stderr).to.contain('already exists');
    });
  });
});
