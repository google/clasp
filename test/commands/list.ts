import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp list function', () => {
  before(setup);
  it('should list clasp projects correctly', () => {
    const result = runClasp(['list']);
    // Every project starts with this base URL, thus
    // using clasp list should at least contain this
    // in its output.
    expect(result.stdout).to.contain('https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
  it('does not shorten project names when indicated not to', () => {
    const result = runClasp(['list', '--noShorten']);
    expect(result.stdout).to.contain('https://script.google.com/d/');
    expect(result.stdout).to.not.contain('…');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
