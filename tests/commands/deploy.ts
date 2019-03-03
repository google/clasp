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

describe('Test clasp deploy function', () => {
  before(setup);
  // Could fail to to maximum deployments (20)
  // TODO: skip test if at maximum
  it('should deploy correctly', () => {
    const result = spawnSync(
      CLASP, ['deploy'], { encoding: 'utf8' },
    );
    if (result.stderr) {
      const err1 = 'Scripts may only have up to 20 versioned deployments at a time';
      const err2 = 'Currently just one deployment can be created at a time';
      const re = `(?:${err1}|${err2})`;
      expect([result.stderr]).to.match(new RegExp(re));
      expect(result.status).to.equal(1);
    } else {
      expect(result.stdout).to.contain('Created version ');
      expect(result.status).to.equal(0);
    }
  });
  after(cleanup);
});