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

describe('Test clasp pull function', () => {
  before(setup);
  it('should pull an existing project correctly', () => {
    const result = spawnSync(
      CLASP, ['pull'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});