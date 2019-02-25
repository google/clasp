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

describe('Test clasp logs function', () => {
  before(setupWithoutGCPProject);
  it('should prompt for logs setup', () => {
    const result = spawnSync(
      CLASP, ['logs'], { encoding: 'utf8' },  // --setup is default behaviour
    );
    expect(result.stdout).to.contain('What is your GCP projectId?');
  });
  it('should prompt for logs setup', () => {
    const result = spawnSync(
      CLASP, ['logs', '--setup'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('Open this link:');
    expect(result.stdout).to.include(`https://script.google.com/d/${SCRIPT_ID}/edit`);
    expect(result.stdout).to.contain('Go to *Resource > Cloud Platform Project...*');
    expect(result.stdout).to.include('and copy your projectId\n  (including "project-id-")');
    expect(result.stdout).to.contain('What is your GCP projectId?');
  });
  after(cleanup);
});