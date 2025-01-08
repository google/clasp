import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp deployments function', () => {
  before(setup);
  it('should list deployments correctly', () => {
    const result = runClasp(['deployments']);
    expect(result.stdout).to.contain('Deployment');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
