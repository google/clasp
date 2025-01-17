import {expect} from 'chai';
import fs from 'fs-extra';
import {after, before, describe, it} from 'mocha';

import {LOG} from '../../src/messages.js';
import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp create function', () => {
  before(setup);
  it('should fail if project already exists', () => {
    fs.writeFileSync('.clasp.json', '');
    const result = runClasp(['create'], {encoding: 'utf8', maxBuffer: 10 * 1024 * 1024});
    expect(result.stderr).to.match(/Project file \(.*\) already exists./);
  });
  after(cleanup);
});

describe('Test clasp create <title> function', () => {
  before(setup);
  it('should create a new project named <title> correctly', () => {
    fs.removeSync('.clasp.json');
    const result = runClasp(['create', '--type', 'Standalone', '--title', 'myTitle']);
    expect(result.stdout).to.contain('Created new Standalone script: https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp create <parentId> function', () => {
  before(setup);
  it('should not prompt for script types with parentId', () => {
    fs.removeSync('.clasp.json');
    const result = runClasp(['create', '--parentId', '"1D_Gxyv*****************************NXO7o"']);
    expect(result.stdout).to.not.contain(LOG.CREATE_SCRIPT_QUESTION);
    expect(result.stderr).to.contain('Request contains an invalid argument.');
  });
  after(cleanup);
});
