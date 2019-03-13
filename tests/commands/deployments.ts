import { expect } from 'chai';
import { describe, it } from 'mocha';
const { spawnSync } = require('child_process');

import {
  CLASP,
} from '../constants';

import {
  cleanup,
  setup,
} from '../functions';

describe('Test clasp deployments function', () => {
  before(setup);
  it('should list deployments correctly', () => {
    const result = spawnSync(
      CLASP, ['deployments'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Deployment');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});