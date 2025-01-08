import {expect} from 'chai';
import {spawnSync} from 'child_process';
import fs from 'fs-extra';
import {after, before, describe, it} from 'mocha';

import {URL} from '../../src/urls.js';
import {ERROR, LOG} from '../../src/messages.js';
import {SCRIPT_ID} from '../constants.js';
import {cleanup, runClasp, setup} from '../functions.js';

describe('Test clasp clone <scriptId> function', () => {
  before(setup);
  it('should clone a project with scriptId correctly', () => {
    cleanup();
    const result = runClasp(['clone', SCRIPT_ID], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.stdout).to.contain(LOG.STATUS_PUSH);
    expect(result.stdout).to.contain(LOG.STATUS_IGNORE);
    expect(result.status).to.equal(0);
  });
  it('should clone a project with scriptURL correctly', () => {
    cleanup();
    const result = runClasp(['clone', URL.SCRIPT(SCRIPT_ID)], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.stdout).to.contain(LOG.STATUS_PUSH);
    expect(result.stdout).to.contain(LOG.STATUS_IGNORE);
    expect(result.status).to.equal(0);
  });
  it('should give an error on a non-existing project', () => {
    fs.removeSync('./.clasp.json');
    const result = runClasp(['clone', 'non-existing-project'], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stderr).to.contain(ERROR.SCRIPT_ID);
    expect(result.status).to.equal(1);
  });
  it('should not write clasp config for non-existing project', () => {
    fs.removeSync('./.clasp.json');
    const result = runClasp(['clone', 'non-existing-project'], {maxBuffer: 10 * 1024 * 1024});
    expect(result.status).to.equal(1);
    expect(fs.existsSync('./.clasp.json')).to.be.false;
  });
  after(cleanup);
});

describe('Test clasp clone function', () => {
  before(setup);
  it('should prompt for which script to clone correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = runClasp(['clone'], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stdout).to.contain(LOG.CLONE_SCRIPT_QUESTION);
    expect(result.status).to.equal(0);
  });
  it('should prompt which project to clone and clone it', () => {
    cleanup();
    const result = runClasp(['clone'], {input: '\n', maxBuffer: 10 * 1024 * 1024});
    expect(result.stdout).to.contain(LOG.CLONE_SCRIPT_QUESTION);
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.stdout).to.contain(LOG.STATUS_PUSH);
    expect(result.stdout).to.contain(LOG.STATUS_IGNORE);
    expect(result.status).to.equal(0);
  });
  it('should give an error if .clasp.json already exists', () => {
    fs.writeFileSync('.clasp.json', '');
    const result = runClasp(['clone'], {maxBuffer: 10 * 1024 * 1024});
    expect(result.stderr).to.match(/Project file \(.*\) already exists./);
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});
