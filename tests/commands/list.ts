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

describe('Test clasp list function', () => {
  before(setup);
  it('should list clasp projects correctly', () => {
    const result = spawnSync(
      CLASP, ['list'], { encoding: 'utf8' },
    );
    // Every project starts with this base URL, thus
    // using clasp list should at least contain this
    // in its output.
    expect(result.stdout).to.contain('https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});