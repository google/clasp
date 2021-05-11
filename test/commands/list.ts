import {expect} from 'chai';
import {spawnSync} from 'child_process';
import {after, before, describe, it} from 'mocha';

import {CLASP} from '../constants.js';
import {cleanup, setup} from '../functions.js';

describe('Test clasp list function', () => {
  before(setup);
  it('should list clasp projects correctly', () => {
    const result = spawnSync(CLASP, ['list'], {encoding: 'utf8'});
    // Every project starts with this base URL, thus
    // using clasp list should at least contain this
    // in its output.
    expect(result.stdout).to.contain('https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
  it('does not shorten project names when indicated not to', () => {
    const result = spawnSync(CLASP, ['list', '--noShorten'], {encoding: 'utf8'});
    expect(result.stdout).to.contain('https://script.google.com/d/');
    expect(result.stdout).to.not.contain('…');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
