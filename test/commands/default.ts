import {expect} from 'chai';
import {spawnSync} from 'child_process';
import {describe, it} from 'mocha';

import {CLASP} from '../constants.js';

describe('Test missing command function', () => {
  it('should report missing command correctly', () => {
    const result = spawnSync(CLASP, ['parboil'], {encoding: 'utf8'});
    const expected = 'Unknown command "clasp parboil"';
    expect(result.stderr).to.contain(expected);
    expect(result.status).to.equal(1);
  });
});
