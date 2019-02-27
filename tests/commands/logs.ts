import { expect } from 'chai';
import { describe, it } from 'mocha';
const { spawnSync } = require('child_process');

import { CLASP } from '../constants';

import {
  cleanup,
  setup,
  setupWithoutGCPProject,
} from '../functions';

import { LOG } from '../../src/utils';

describe('Test clasp logs setup', () => {
  before(setupWithoutGCPProject);
  it('should prompt for logs setup', () => {
    const result = spawnSync(
      CLASP, ['logs'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`${LOG.ASK_PROJECT_ID}`);
  });
  it('should prompt for logs setup', () => {
    const result = spawnSync(
      CLASP, ['logs', '--setup'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`${LOG.ASK_PROJECT_ID}`);
  });
  after(cleanup);
});

describe('Test clasp logs function', () => {
  before(setup);
  it('should get some logs', () => {
    const result = spawnSync(
      CLASP, ['logs'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
     // Example log line:
     // tslint:disable-next-line:max-line-length
     // NOTICE               2019-02-26T05:10:20.658Z google.api.serviceusage.v1.ServiceUsage.EnableService Setting up StackDriver Logging.
     // ... we'll just expect there to be *some* stdout.
    expect(result.stdout).lengthOf.greaterThan(10);
  });
  after(cleanup);
});