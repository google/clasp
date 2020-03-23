import { spawnSync } from 'child_process';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  CLASP,
} from '../constants';
import { cleanup, setup } from '../functions';

describe('Test clasp metrics function', () => {
  before(setup);
  it('should display metrics', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const result = spawnSync(
      CLASP, ['metrics'], { encoding: 'utf8' },
    );

    expect(result.stderr).to.contain('UTC Date');
    expect(result.stdout).to.contain(yesterday.toISOString().slice(0, 10));
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});