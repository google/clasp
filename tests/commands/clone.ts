import { spawnSync } from 'child_process';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { describe, it } from 'mocha';
import { UTF8 } from '../../src/globals';
import { URL } from '../../src/urls';
import { ERROR } from '../../src/utils';
import { CLASP, SCRIPT_ID } from '../constants';
import { cleanup, setup } from '../functions';

describe('Test clasp clone <scriptId> function', () => {
  before(setup);
  it('should clone a project with scriptId correctly', () => {
    cleanup();
    const result = spawnSync(
      CLASP, ['clone', SCRIPT_ID], { encoding: UTF8 },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  it('should clone a project with scriptURL correctly', () => {
    cleanup();
    const result = spawnSync(
      CLASP, ['clone', URL.SCRIPT(SCRIPT_ID)], { encoding: UTF8 },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  it('should give an error on a non-existing project', () => {
    fs.removeSync('./.clasp.json');
    const result = spawnSync(
      CLASP, ['clone', 'non-existing-project'], { encoding: UTF8 },
    );
    expect(result.stderr).to.contain(ERROR.SCRIPT_ID);
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});

describe('Test clasp clone function', () => {
  before(setup);
  it('should prompt for which script to clone correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      CLASP, ['clone'], { encoding: UTF8 },
    );
    expect(result.stdout).to.contain('Clone which script?');
  });
  it('should prompt which project to clone and clone it', () => {
    cleanup();
    const result = spawnSync(
      CLASP, ['clone'], { encoding: UTF8, input: '\n'},
    );
    expect(result.stdout).to.contain('Clone which script?');
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  it('should give an error if .clasp.json already exists', () => {
    fs.writeFileSync('.clasp.json', '');
    const result = spawnSync(
      CLASP, ['clone'], { encoding: UTF8 },
    );
    expect(result.stderr).to.contain('Project file (.clasp.json) already exists.');
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});
