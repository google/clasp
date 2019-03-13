import { expect } from 'chai';
import { describe, it } from 'mocha';
const { spawnSync } = require('child_process');

import {
  CLASP, PROJECT_ID,
} from '../constants';

import {
  cleanup,
  setup,
} from '../functions';

import { URL } from '../../src/urls';

describe('Test clasp apis functions', () => {
  before(setup);
  it('should list apis correctly', () => {
    const result = spawnSync(
      CLASP, ['apis', 'list'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('# Currently enabled APIs:');
    expect(result.stdout).to.contain('# List of available APIs:');
  });
  it('should ask for an API when trying to enable', () => {
    const result = spawnSync(
      CLASP, ['apis', 'enable'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('An API name is required.');
  });
  it('should enable sheets', () => {
    const result = spawnSync(
      CLASP, ['apis', 'enable', 'sheets'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('Enabled sheets API.');
  });
  it('should give error message for non-existent API', () => {
    const result = spawnSync(
      CLASP, ['apis', 'enable', 'fakeApi'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('API fakeApi doesn\'t exist. Try \'clasp apis enable sheets\'.');
  });
  it('should ask for an API when trying to disable', () => {
    const result = spawnSync(
      CLASP, ['apis', 'disable'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('An API name is required.');
  });
  it('should disable apis correctly', () => {
    const result = spawnSync(
      CLASP, ['apis', 'disable', 'sheets'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('Disabled sheets API.');
  });
  it('should show suggestions for using clasp apis', () => {
    const result = spawnSync(
      CLASP, ['apis'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`# Try these commands:
- clasp apis list
- clasp apis enable slides
- clasp apis disable slides`);
  });
  it('should error with unknown subcommand', () => {
    const result = spawnSync(
      CLASP, ['apis', 'unknown'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain(`Unknown command`);
  });
  it('should open APIs dashboard', () => {
    const result = spawnSync(
      CLASP, ['apis', '--open'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(URL.APIS(PROJECT_ID));
  });
  after(cleanup);
});