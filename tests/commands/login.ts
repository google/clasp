import { expect } from 'chai';
import { describe, it } from 'mocha';
import * as fs from 'fs-extra';
const { spawnSync } = require('child_process');

import {
  CLASP,
  CLASP_PATHS,
  CLIENT_CREDS,
  FAKE_CLASPRC,
} from '../constants';

import {
  backupSettings,
  cleanup,
  restoreSettings,
  rndStr,
  setup,
} from '../functions';

import {
  LOG,
  ERROR,
} from '../../src/utils';

describe('Test clasp login function', () => {
  before(setup);
  beforeEach(backupSettings);
  afterEach(restoreSettings);
  it('should exit(0) with LOG.DEFAULT_CREDENTIALS for default login (no global or local rc)', () => {
    if (fs.existsSync(CLASP_PATHS.rcGlobal)) fs.removeSync(CLASP_PATHS.rcGlobal);
    if (fs.existsSync(CLASP_PATHS.rcLocal)) fs.removeSync(CLASP_PATHS.rcLocal);
    const result = spawnSync(
      CLASP, ['login', '--no-localhost'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain(LOG.LOGIN(false));
    expect(result.status).to.equal(0);
  });
  it('should ERROR.LOGGED_IN if global rc and no --creds option but continue to login', () => {
    fs.writeFileSync(CLASP_PATHS.rcGlobal, FAKE_CLASPRC.token);
    const result = spawnSync(
      CLASP, ['login', '--no-localhost'], { encoding: 'utf8' },
    );
    fs.removeSync(CLASP_PATHS.rcGlobal);
    expect(result.stderr).to.contain(ERROR.LOGGED_IN_GLOBAL);
    expect(result.status).to.equal(0);
  });
  it('should exit(0) with ERROR.LOGGED_IN if local rc and --creds option', () => {
    fs.writeFileSync(CLASP_PATHS.rcLocal, FAKE_CLASPRC.local);
    const result = spawnSync(
      CLASP, ['login', '--creds', `${CLASP_PATHS.clientCredsLocal}`, '--no-localhost'], { encoding: 'utf8' },
    );
    fs.removeSync(CLASP_PATHS.rcLocal);
    expect(result.stderr).to.contain(ERROR.LOGGED_IN_LOCAL);
    expect(result.status).to.equal(1);
  });
  it.skip('should exit(1) with ERROR.CREDENTIALS_DNE if --creds file does not exist', () => {
    if (fs.existsSync(CLASP_PATHS.clientCredsLocal)) fs.removeSync(CLASP_PATHS.clientCredsLocal);
    const result = spawnSync(
      CLASP, ['login', '--creds', `${CLASP_PATHS.clientCredsLocal}`, '--no-localhost'], { encoding: 'utf8' },
    );
    expect(result.stderr).to.contain(ERROR.CREDENTIALS_DNE(CLASP_PATHS.clientCredsLocal));
    expect(result.status).to.equal(1);
  });
  it.skip('should exit(1) with ERROR.BAD_CREDENTIALS_FILE if --creds file invalid', () => {
    fs.writeFileSync(CLASP_PATHS.clientCredsLocal, CLIENT_CREDS.invalid);
    const result = spawnSync(
      CLASP, ['login', '--creds', `${CLASP_PATHS.clientCredsLocal}`, '--no-localhost'], { encoding: 'utf8' },
    );
    fs.removeSync(CLASP_PATHS.clientCredsLocal);
    expect(result.stderr).to.contain(ERROR.BAD_CREDENTIALS_FILE);
    expect(result.status).to.equal(1);
  });
  it.skip('should exit(0) with ERROR.BAD_CREDENTIALS_FILE if --creds file corrupt json', () => {
    fs.writeFileSync(CLASP_PATHS.clientCredsLocal, rndStr());
    const result = spawnSync(
      CLASP, ['login', '--creds', `${CLASP_PATHS.clientCredsLocal}`, '--no-localhost'], { encoding: 'utf8' },
    );
    fs.removeSync(CLASP_PATHS.clientCredsLocal);
    expect(result.stderr).to.contain(ERROR.BAD_CREDENTIALS_FILE);
    expect(result.status).to.equal(1);
  });
  it('should exit(1) with LOG.CREDS_FROM_PROJECT if global rc and --creds file valid', () => {
    if (fs.existsSync(CLASP_PATHS.rcLocal)) fs.removeSync(CLASP_PATHS.rcLocal);
    fs.writeFileSync(CLASP_PATHS.rcGlobal, FAKE_CLASPRC.token);
    fs.writeFileSync(CLASP_PATHS.clientCredsLocal, CLIENT_CREDS.fake);
    const result = spawnSync(
      CLASP, ['login', '--creds', `${CLASP_PATHS.clientCredsLocal}`, '--no-localhost'], { encoding: 'utf8' },
    );
    fs.removeSync(CLASP_PATHS.rcGlobal);
    fs.removeSync(CLASP_PATHS.clientCredsLocal);
    expect(result.stdout).to.contain(LOG.LOGIN(true));
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});