import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {use} from 'chai';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import {mockListVersions, mockOAuthRefreshRequest, resetMocks, setupMocks} from '../mocks.js';
import {runCommand} from './utils.js';

import {chaiFileExists} from '../helpers.js';
import mock from 'mock-fs';
use(chaiFileExists);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('List versions command', function () {
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

    it('should list scripts', async function () {
      mockListVersions({scriptId: 'mock-script-id'});
      const out = await runCommand(['list-versions']);
      return expect(out.stdout).to.contain('Test version 1');
    });
  });
});
