import {expect} from 'chai';
import {spawnSync} from 'child_process';
import {after, before, describe, it} from 'mocha';

import {URL} from '../../src/urls';
import {ERROR, LOG} from '../../src/messages';
import {CLASP, PARENT_ID, PROJECT_ID, SCRIPT_ID} from '../constants';
import {cleanup, setup} from '../functions';

describe('Test clasp open function', () => {
  before(setup);
  it('should open script correctly', () => {
    const result = spawnSync(CLASP, ['open'], {encoding: 'utf8'});
    expect(result.stdout).to.contain(`Opening script: ${URL.SCRIPT(SCRIPT_ID)}`);
  });
  it('should error with incorrect scriptId if length < 30', () => {
    const result = spawnSync(CLASP, ['open', 'abc123'], {encoding: 'utf8'});
    expect(result.stderr).to.contain(ERROR.SCRIPT_ID_INCORRECT('abc123'));
    expect(result.status).to.equal(1);
  });
  it('open credentials page correctly', () => {
    const result = spawnSync(CLASP, ['open', '--creds'], {encoding: 'utf8'});
    expect(result.stdout).to.contain(LOG.OPEN_CREDS(PROJECT_ID));
  });
  it('open credentials page correctly', () => {
    const result = spawnSync(CLASP, ['open', '--webapp'], {encoding: 'utf8'});
    expect(result.stdout).to.contain('Open which deployment?');
  });
  it('open parent page correctly', () => {
    const result = spawnSync(CLASP, ['open', '--addon'], {encoding: 'utf8'});
    expect(result.stdout).to.contain(LOG.OPEN_FIRST_PARENT(PARENT_ID[0]));
  });
  after(cleanup);
});
