import { spawnSync } from 'child_process';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { UTF8 } from '../../src/globals';
import { CLASP } from '../constants';
import { cleanup, setup } from '../functions';

describe('Test clasp deployments function', () => {
  before(setup);
  it('should list deployments correctly', () => {
    const result = spawnSync(
      CLASP, ['deployments'], { encoding: UTF8 },
    );
    expect(result.stdout).to.contain('Deployment');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});