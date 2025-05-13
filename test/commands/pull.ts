import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {runCommand} from '../../test/commands/utils.js';
import {useChaiExtensions} from '../../test/helpers.js';
import {
  mockOAuthRefreshRequest,
  mockScriptDownload,
  mockScriptDownloadError,
  resetMocks,
  setupMocks,
} from '../../test/mocks.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Pull command', function () {
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
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should pull files', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['pull']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Pulled 2 files');
    });

    it('should pull files into the rootDir', async function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-dist.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockScriptDownload({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['pull']);
      expect('dist/appsscript.json').to.be.a.realFile;
      expect('dist/Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Pulled 2 files');
    });

    it('should pull a specific version', async function () {
      mockScriptDownload({
        scriptId: 'mock-script-id',
        version: 3,
      });
      const out = await runCommand(['pull', '--versionNumber', '3']);
      expect('appsscript.json').to.be.a.realFile;
      expect('Code.js').to.be.a.realFile;
      expect(out.stdout).to.contain('Pulled 2 files');
    });

    it('should handle script download error', async function () {
      mockScriptDownloadError({
        scriptId: 'mock-script-id',
      });
      const out = await runCommand(['pull']);
      expect(out.stdout).to.not.contain('Pulled 2 files');
      expect(out.exitCode).to.not.equal(0);
    });
  });
  describe('Without project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should reject missing project id', async function () {
      const out = await runCommand(['pull']);
      expect(out.stderr).to.contain('not found');
    });
  });
});
