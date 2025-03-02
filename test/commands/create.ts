import {expect} from 'chai';
import fs from 'fs-extra';
import {after, before, describe, it} from 'mocha';

import {CLASP_SETTINGS} from '../constants.js';
import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp create function', function () {
  before(setup);
  it('should fail if project already exists', function () {
    fs.writeFileSync('.clasp.json', CLASP_SETTINGS.valid);
    const result = runClasp(['create'], {encoding: 'utf8', maxBuffer: 10 * 1024 * 1024});
    expect(result.stderr).to.match(/Project file already exists./);
  });
  after(cleanup);
});

describe('Test clasp create <title> function', function () {
  before(setup);
  it('should create a new project named <title> correctly', function () {
    fs.removeSync('.clasp.json');
    const result = runClasp(['create', '--type', 'standalone', '--title', 'myTitle']);
    expect(result.stdout).to.contain('Created new script: https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp create <parentId> function', function () {
  before(setup);
  // TODO - Test doesn't really test parent ID creation works + prompt is disabled without TTY
  it.skip('should not prompt for script types with parentId', function () {
    fs.removeSync('.clasp.json');
    const result = runClasp(['create', '--parentId', '"1D_Gxyv*****************************NXO7o"']);
    expect(result.stdout).to.not.contain('Create which script');
    expect(result.stderr).to.contain('Request contains an invalid argument.');
  });
  after(cleanup);
});
