import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp logs function', function () {
  before(setup);
  it('should get some logs', function () {
    const result = runClasp(['logs']);
    // Example log line:
    // NOTICE               2019-02-26T05:10:20.658Z google.api.serviceusage.v1.ServiceUsage.EnableService Setting up StackDriver Logging.
    // ... we'll just expect there to be *some* stdout.
    expect(result.stdout).lengthOf.greaterThan(10);
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
