import {expect} from 'chai';
import {spawnSync} from 'child_process';
import {after, before, describe, it} from 'mocha';

import {LOG} from '../../src/messages.js';
import {CLASP} from '../constants.js';
import {cleanup, setup, setupWithoutGCPProject} from '../functions.js';

describe('Test clasp logs setup', () => {
  before(setupWithoutGCPProject);
  it('should prompt for logs setup', () => {
    const result = spawnSync(CLASP, ['logs'], {encoding: 'utf8'});
    expect(result.stdout).to.contain(`${LOG.ASK_PROJECT_ID}`);
    expect(result.status).to.equal(0);
  });
  it('should prompt for logs setup', () => {
    const result = spawnSync(CLASP, ['logs', '--setup'], {encoding: 'utf8'});
    expect(result.stdout).to.contain(`${LOG.ASK_PROJECT_ID}`);
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});

describe('Test clasp logs function', () => {
  before(setup);
  it('should get some logs', () => {
    const result = spawnSync(CLASP, ['logs'], {encoding: 'utf8'});
    // Example log line:
    // NOTICE               2019-02-26T05:10:20.658Z google.api.serviceusage.v1.ServiceUsage.EnableService Setting up StackDriver Logging.
    // ... we'll just expect there to be *some* stdout.
    expect(result.stdout).lengthOf.greaterThan(10);
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
