import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {cleanup, runClasp, setupWithRunManifest} from '../functions.js';

describe.skip('Test clasp run function', function () {
  // TODO - Fix script to properly deploy & run
  before(setupWithRunManifest);
  it('should properly run in dev mode', function () {
    const result = runClasp(['run', 'test']);
    expect(result.stdout).to.include('Running in dev mode.');
  });

  after(cleanup);
});
