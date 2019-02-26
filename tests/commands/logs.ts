import { expect } from 'chai';
import { describe, it } from 'mocha';
const { spawnSync } = require('child_process');

import {
  CLASP,
  SCRIPT_ID,
} from '../constants';

import {
  cleanup,
  setupWithoutGCPProject,
} from '../functions';

import {
  LOG,
} from '../../src/utils';

describe('Test clasp logs function', () => {
  before(setupWithoutGCPProject);
  it('should prompt for logs setup', () => {
    const result = spawnSync(
      CLASP, ['logs'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`${LOG.OPEN_LINK(LOG.SCRIPT_LINK(SCRIPT_ID))}\n`);
    expect(result.stdout).to.contain(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);
    expect(result.stdout).to.contain(`${LOG.ASK_PROJECT_ID}`);
  });
  it('should prompt for logs setup', () => {
    const result = spawnSync(
      CLASP, ['logs', '--setup'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`${LOG.OPEN_LINK(LOG.SCRIPT_LINK(SCRIPT_ID))}\n`);
    expect(result.stdout).to.contain(`${LOG.GET_PROJECT_ID_INSTRUCTIONS}\n`);
    expect(result.stdout).to.contain(`${LOG.ASK_PROJECT_ID}`);
  });
  after(cleanup);
});