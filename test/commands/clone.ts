import {expect} from 'chai';
import fs from 'fs-extra';
import {after, before, describe, it} from 'mocha';

import {CLASP_SETTINGS, SCRIPT_ID} from '../constants.js';
import {cleanup, runClasp, setup} from '../functions.js';
import {URL} from '../urls.js';

describe('Test clasp clone <scriptId> function', function () {
  before(setup);
  it('should clone a project with scriptId correctly', function () {
    cleanup();
    const result = runClasp(['clone', SCRIPT_ID], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  it('should clone a project with scriptURL correctly', function () {
    cleanup();
    const result = runClasp(['clone', URL.SCRIPT(SCRIPT_ID)], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  it('should give an error on a non-existing project', function () {
    fs.removeSync('./.clasp.json');
    const result = runClasp(['clone', 'non-existing-project'], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stderr).to.contain('Invalid script ID');
    expect(result.status).to.equal(1);
  });
  it('should not write clasp config for non-existing project', function () {
    fs.removeSync('./.clasp.json');
    const result = runClasp(['clone', 'non-existing-project'], {maxBuffer: 10 * 1024 * 1024});
    expect(result.status).to.equal(1);
    expect(fs.existsSync('./.clasp.json')).to.be.false;
  });
  it('should give an error if .clasp.json already exists', function () {
    fs.writeFileSync('.clasp.json', CLASP_SETTINGS.valid);
    const result = runClasp(['clone'], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stderr).to.match(/Project file already exists./);
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});
