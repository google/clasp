import fs from 'fs-extra';
import {expect} from 'chai';
import {spawnSync} from 'child_process';
import {before, describe, it} from 'mocha';
import {Conf} from '../../src/conf.js';

// import {LOG} from '../../src/messages.js';
import {CLASP} from '../constants.js';
import {cleanup, setup} from '../functions.js';
import {LOG} from '../../src/messages.js';

const config = Conf.get();

describe('Test clasp delete function with standalone script', () => {
  before(setup);
  it('should create a new project correctly before delete', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(CLASP, ['create', '--type', 'standalone', '--title', 'myTitleToDelete'], {
      encoding: 'utf8',
    });
    expect(result.status).to.equal(0);
  });

  it('should delete the new project correctly', () => {
    const result = spawnSync(CLASP, ['delete', '-f'], {
      encoding: 'utf8',
    });
    expect(result.stdout).to.contains(LOG.DELETE_DRIVE_FILE_FINISH);
    expect(fs.existsSync(config.projectConfig!)).to.be.false;
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});

describe('Test clasp delete function with a parent project', () => {
  before(setup);
  it('should create a new project correctly before delete', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(CLASP, ['create', '--type', 'sheets', '--title', 'myTitleToDelete'], {
      encoding: 'utf8',
    });
    expect(result.status).to.equal(0);
  });

  it('should ask if delete the parent project', () => {
    const result = spawnSync(CLASP, ['delete'], {
      encoding: 'utf8',
    });
    expect(result.stdout).to.contain(LOG.DELETE_DRIVE_FILE_WITH_PARENT_CONFIRM);
    expect(result.status).to.equal(0);
  });

  it('should delete the new project correctly', () => {
    const result = spawnSync(CLASP, ['delete', '-f'], {
      encoding: 'utf8',
    });
    expect(result.stdout).to.contains(LOG.DELETE_DRIVE_FILE_FINISH);
    expect(fs.existsSync(config.projectConfig!)).to.be.false;
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});
