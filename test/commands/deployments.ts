import {expect} from 'chai';
import {spawnSync} from 'child_process';
import {after, before, describe, it} from 'mocha';

import {CLASP} from '../constants.js';
import {cleanup, setup} from '../functions.js';

describe('Test clasp deployments function', () => {
  before(setup);
  it('should list deployments correctly', () => {
    const result = spawnSync(CLASP, ['deployments'], {encoding: 'utf8'});
    expect(result.stdout).to.contain('Deployment');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
