import { expect } from 'chai';
import * as fs from 'fs-extra';
import { describe, it } from 'mocha';
const { spawnSync } = require('child_process');

import {
  CLASP,
  CLASP_PATHS,
  FAKE_CLASPRC,
} from '../constants';

import {
  backupSettings,
  cleanup,
  restoreSettings,
  setup,
} from '../functions';

import {
  hasOauthClientSettings,
} from '../../src/utils';

describe('Test clasp logout function', () => {
  before(setup);
  beforeEach(backupSettings);
  it('should remove global AND local credentails', () => {
    fs.writeFileSync(CLASP_PATHS.rcGlobal, FAKE_CLASPRC.token);
    fs.writeFileSync(CLASP_PATHS.rcLocal, FAKE_CLASPRC.local);
    const result = spawnSync(
      CLASP, ['logout'], { encoding: 'utf8' },
    );
    expect(fs.existsSync(CLASP_PATHS.rcGlobal)).to.equal(false);
    expect(hasOauthClientSettings()).to.equal(false);
    expect(fs.existsSync(CLASP_PATHS.rcLocal)).to.equal(false);
    expect(hasOauthClientSettings(true)).to.equal(false);
    expect(result.status).to.equal(0);
  });
  it('should still work with no clasprc file', () => {
    const result = spawnSync(
      CLASP, ['logout'], { encoding: 'utf8' },
    );
    expect(fs.existsSync(CLASP_PATHS.rcGlobal)).to.equal(false);
    expect(hasOauthClientSettings()).to.equal(false);
    expect(fs.existsSync(CLASP_PATHS.rcLocal)).to.equal(false);
    expect(hasOauthClientSettings(true)).to.equal(false);
    expect(result.status).to.equal(0);
  });
  after(() => {
    restoreSettings();
    cleanup();
  });
});