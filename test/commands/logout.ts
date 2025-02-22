import {expect} from 'chai';
import fs from 'fs-extra';
import {after, afterEach, before, beforeEach, describe, it} from 'mocha';

import {CLASP_PATHS, FAKE_CLASPRC} from '../constants.js';
import {backupSettings, cleanup, restoreSettings, runClasp, setup} from '../functions.js';

describe('Test clasp logout function', function () {
  before(setup);
  beforeEach(backupSettings);
  afterEach(restoreSettings);
  it('should remove credentials', function () {
    fs.writeFileSync(CLASP_PATHS.rcGlobal, FAKE_CLASPRC.token);
    runClasp(['logout']);
    const result = runClasp(['pull']);
    expect(result.stderr).to.include('No credentials found');
  });
  it('should still work with no clasprc file', function () {
    const result = runClasp(['logout']);
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
