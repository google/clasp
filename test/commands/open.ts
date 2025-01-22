import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {ERROR, LOG} from '../../src/messages.js';
import {URL} from '../../src/urls.js';
import {PARENT_ID, PROJECT_ID, SCRIPT_ID} from '../constants.js';
import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp open function', () => {
  before(setup);
  it('should open script correctly', () => {
    const result = runClasp(['open']);
    expect(result.stdout).to.contain(`Opening script: ${URL.SCRIPT(SCRIPT_ID)}`);
  });
  it('should error with incorrect scriptId if length < 30', () => {
    const result = runClasp(['open', 'abc123']);
    expect(result.stderr).to.contain(ERROR.SCRIPT_ID_INCORRECT('abc123'));
    expect(result.status).to.equal(1);
  });
  it('open credentials page correctly', () => {
    const result = runClasp(['open', '--creds']);
    expect(result.stdout).to.contain(LOG.OPEN_CREDS(PROJECT_ID));
  });
  it('open webapp page correctly', () => {
    const result = runClasp(['open', '--webapp']);
    expect(result.stdout).to.contain('Open which deployment?');
  });
  it('open parent page correctly', () => {
    const result = runClasp(['open', '--addon']);
    console.log(result.stdout);
    console.log(result.stderr);
    expect(result.stdout).to.contain(LOG.OPEN_FIRST_PARENT(PARENT_ID[0]));
  });
  // FIXME: `deploymentId` should be valid value:
  it.skip('open webapp with deploymentId page correctly', () => {
    const result = runClasp(['open', '--webapp', '--deploymentId', 'abcd1234']);
    expect(result.stdout).to.contain(LOG.OPEN_WEBAPP('abcd1234'));
  });
  after(cleanup);
});
