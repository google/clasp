import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {URL} from '../../src/urls.js';
import {PROJECT_ID} from '../constants.js';
import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp apis functions', () => {
  before(setup);
  it('should list apis correctly', () => {
    const result = runClasp(['apis', 'list']);
    expect(result.stdout).to.contain('# Currently enabled APIs:');
    expect(result.stdout).to.contain('# List of available APIs:');
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
  it('should ask for an API when trying to enable', () => {
    const result = runClasp(['apis', 'enable']);
    expect(result.stderr).to.contain('An API name is required.');
    expect(result.status).to.equal(1);
  });
  it('should enable sheets', () => {
    const result = runClasp(['apis', 'enable', 'sheets']);
    expect(result.stdout).to.contain('Enabled sheets API.');
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
  it('should give error message for non-existent API', () => {
    const result = runClasp(['apis', 'enable', 'fakeApi']);
    expect(result.stderr).to.contain("API fakeApi doesn't exist. Try 'clasp apis enable sheets'.");
    expect(result.status).to.equal(1);
  });
  it('should ask for an API when trying to disable', () => {
    const result = runClasp(['apis', 'disable']);
    expect(result.stderr).to.contain('An API name is required.');
    expect(result.status).to.equal(1);
  });
  it('should disable apis correctly', () => {
    const result = runClasp(['apis', 'disable', 'sheets']);
    expect(result.stdout).to.contain('Disabled sheets API.');
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
  it('should show suggestions for using clasp apis', () => {
    const result = runClasp(['apis']);
    expect(result.stdout).to.contain(`# Try these commands:
- clasp apis list
- clasp apis enable slides
- clasp apis disable slides`);
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
  it('should error with unknown subcommand', () => {
    const result = runClasp(['apis', 'unknown']);
    expect(result.stderr).to.contain('Unknown command');
    expect(result.status).to.equal(1);
  });
  it('should open APIs dashboard', () => {
    const result = runClasp(['apis', '--open']);
    expect(result.stdout).to.contain(URL.APIS(PROJECT_ID));
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
