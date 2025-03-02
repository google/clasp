import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp open functions', function () {
  before(setup);
  it('should open script correctly', function () {
    const result = runClasp(['open-script']);
    expect(result.stdout).to.contain(`Open`);
  });
  it('open credentials page correctly', function () {
    const result = runClasp(['open-credentials-setup']);
    expect(result.stdout).to.contain('Open');
  });
  it('open parent page correctly', function () {
    const result = runClasp(['open-container']);
    expect(result.stdout).to.contain('Open');
  });
  // FIXME: `deploymentId` should be valid value:
  it.skip('open webapp with deploymentId page correctly', function () {
    const result = runClasp(['open-web-app', '--deploymentId', 'abcd1234']);
    expect(result.stdout).to.contain('Open');
  });
  after(cleanup);
});
