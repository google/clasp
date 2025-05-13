import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import inquirer from 'inquirer';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import sinon from 'sinon';
import {runCommand} from '../../test/commands/utils.js';
import {mockListLogEntries, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../../test/mocks.js';
import {forceInteractiveMode} from '../../test/mocks.js';
import {useChaiExtensions} from '../helpers.js';

useChaiExtensions();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Tail logs command', function () {
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
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-gcp-project.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should print logs', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['tail-logs']);
      expect(out.stdout).to.contain('INFO');
      expect(out.stdout).to.contain('myFunction');
      expect(out.stdout).to.contain('test log');
    });

    it('should print logs in json', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['tail-logs', '--json']);
      expect(out.stdout).to.contain('"severity": "INFO"');
      expect(out.stdout).to.contain('"function_name": "myFunction"');
      expect(out.stdout).to.contain('"textPayload": "test log"');
    });

    it('should print logs without timestamps', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['tail-logs', '--simplified']);
      expect(out.stdout).to.contain('INFO');
      expect(out.stdout).to.contain('myFunction');
      expect(out.stdout).to.contain('test log');
      expect(out.stdout).to.not.contain('GMT');
    });

    it('should prompt for project id', async function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      forceInteractiveMode(true);
      sinon.stub(inquirer, 'prompt').resolves({projectId: 'mock-gcp-project'});
      const out = await runCommand(['tail-logs']);
      expect(out.stdout).to.contain('INFO');
    });

    it('should use alias', async function () {
      mockListLogEntries({
        projectId: 'mock-gcp-project',
      });
      const out = await runCommand(['logs']);
      expect(out.stdout).to.contain('INFO');
    });
  });
  describe('Without project, authenticated', function () {
    beforeEach(function () {
      mockfs({
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../../test/fixtures/dot-clasp-no-settings.json')),
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../../test/fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });

    it('should reject missing project id', async function () {
      forceInteractiveMode(false);
      const out = await runCommand(['tail-logs']);
      expect(out.stderr).to.contain('not set');
    });
  });
});
