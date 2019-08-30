import { spawnSync } from 'child_process';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { CLASP } from '../constants';
import { cleanup, setup } from '../functions';

describe('Test clasp deployments function', () => {
  before(setup);
  it('should list deployments correctly', () => {
    const result = spawnSync(
      CLASP, ['deployments'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Deployment');
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});