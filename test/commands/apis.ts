import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {PROJECT_ID} from '../constants.js';
import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp apis functions', () => {
  before(setup);
  it('should list apis correctly', function () {
    const result = runClasp(['list-apis']);
    expect(result.stdout).to.contain('# Currently enabled APIs:');
    expect(result.stdout).to.contain('# List of available APIs:');
    expect(result.status).to.equal(0);
  });
  it('should ask for an API when trying to enable', function () {
    const result = runClasp(['enable-api']);
    expect(result.stderr).to.include('missing required argument');
    expect(result.status).to.equal(1);
  });
  it('should enable sheets', function () {
    const result = runClasp(['enable-api', 'sheets']);
    expect(result.stdout).to.contain('Enabled sheets API.');
    expect(result.status).to.equal(0);
  });
  it('should give error message for non-existent API', function () {
    const result = runClasp(['enable-api', 'fakeApi']);
    expect(result.stderr).to.contain('does not exist');
    expect(result.status).to.equal(1);
  });
  it('should ask for an API when trying to disable', function () {
    const result = runClasp(['disable-api']);
    expect(result.stderr).to.include('missing required argument');
    expect(result.status).to.equal(1);
  });
  it('should disable apis correctly', function () {
    const result = runClasp(['disable-api', 'sheets']);
    expect(result.stdout).to.contain('Disabled sheets API.');
    expect(result.status).to.equal(0);
  });
  it('should open APIs dashboard', function () {
    const result = runClasp(['open-api-console']);
    expect(result.stdout).to.contain(`https://console.developers.google.com/apis/dashboard?project=${PROJECT_ID}`);
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
