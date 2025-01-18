import {expect} from 'chai';
import fs from 'fs-extra';
import {after, afterEach, before, beforeEach, describe, it} from 'mocha';

import {CLASP_PATHS, FAKE_CLASPRC} from '../constants.js';
import {backupSettings, cleanup, restoreSettings, runClasp, setup} from '../functions.js';

describe('Test clasp logout function', () => {
  before(setup);
  beforeEach(backupSettings);
  afterEach(restoreSettings);
  it('should remove global AND local credentials', () => {
    fs.writeFileSync(CLASP_PATHS.rcGlobal, FAKE_CLASPRC.token);
    fs.writeFileSync(CLASP_PATHS.rcLocal, FAKE_CLASPRC.local);
    runClasp(['logout']);
    const result = runClasp(['pull']);
    expect(result.stderr).to.include('Could not read API credentials');
  });
  it('should still work with no clasprc file', () => {
    const result = runClasp(['logout']);
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
