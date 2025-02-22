import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {SCRIPT_ID} from '../constants.js';
import {cleanup, runClasp, setup} from '../functions.js';
import {URL} from '../urls.js';

describe('Test clasp open functions', function () {
  before(setup);
  it('should open script correctly', function () {
    const result = runClasp(['open-script']);
    expect(result.stdout).to.contain(`Opening IDE: ${URL.SCRIPT(SCRIPT_ID)}`);
  });
  it('open credentials page correctly', function () {
    const result = runClasp(['open-credentials-setup']);
    expect(result.stdout).to.contain('Opening credentials');
  });
  it('open parent page correctly', function () {
    const result = runClasp(['open-container']);
    expect(result.stdout).to.contain('Opening');
  });
  // FIXME: `deploymentId` should be valid value:
  it.skip('open webapp with deploymentId page correctly', function () {
    const result = runClasp(['open-web-app', '--deploymentId', 'abcd1234']);
    expect(result.stdout).to.contain('Opening');
  });
  after(cleanup);
});
