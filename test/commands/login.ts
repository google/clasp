import {expect} from 'chai';
import fs from 'fs-extra';
import {after, afterEach, before, beforeEach, describe, it} from 'mocha';

import {ERROR} from '../../src/messages.js';
import {CLASP_PATHS, CLIENT_CREDS, FAKE_CLASPRC} from '../constants.js';
import {backupSettings, cleanup, restoreSettings, randomString, setup, runClasp} from '../functions.js';

describe('Test clasp login function', () => {
  before(setup);
  beforeEach(backupSettings);
  afterEach(restoreSettings);
  it('should exit(0) with LOG.DEFAULT_CREDENTIALS for default login (no global or local rc)', () => {
    if (fs.existsSync(CLASP_PATHS.rcGlobal)) fs.removeSync(CLASP_PATHS.rcGlobal);
    if (fs.existsSync(CLASP_PATHS.rcLocal)) fs.removeSync(CLASP_PATHS.rcLocal);
    const result = runClasp(['login', '--no-localhost']);
    expect(result.stdout).to.contain('https://accounts.google.com');
  });
  it('should exit(0) ERROR.LOGGED_IN if credentials exist but continue to login', () => {
    fs.writeFileSync(CLASP_PATHS.rcGlobal, FAKE_CLASPRC.token);
    const result = runClasp(['login', '--no-localhost'], {input: 'http://localhost/?code=123\n'});
    fs.removeSync(CLASP_PATHS.rcGlobal);
    expect(result.stderr).to.contain(ERROR.LOGGED_IN);
    expect(result.stdout).to.contain('https://accounts.google.com');
  });
  // TODO: this test needs to be updated
  it.skip('should exit(1) with ERROR.CREDENTIALS_DNE if --creds file does not exist', () => {
    if (fs.existsSync(CLASP_PATHS.clientCredsLocal)) fs.removeSync(CLASP_PATHS.clientCredsLocal);
    const result = runClasp(['login', '--creds', `${CLASP_PATHS.clientCredsLocal}`, '--no-localhost']);
    expect(result.stderr).to.contain(ERROR.CREDENTIALS_DNE(CLASP_PATHS.clientCredsLocal));
    expect(result.status).to.equal(1);
  });
  // TODO: this test needs to be updated
  it.skip('should exit(1) with ERROR.BAD_CREDENTIALS_FILE if --creds file invalid', () => {
    fs.writeFileSync(CLASP_PATHS.clientCredsLocal, CLIENT_CREDS.invalid);
    const result = runClasp(['login', '--creds', `${CLASP_PATHS.clientCredsLocal}`, '--no-localhost']);
    fs.removeSync(CLASP_PATHS.clientCredsLocal);
    expect(result.stderr).to.contain(ERROR.BAD_CREDENTIALS_FILE);
    expect(result.status).to.equal(1);
  });
  // TODO: this test needs to be updated
  it.skip('should exit(0) with ERROR.BAD_CREDENTIALS_FILE if --creds file corrupt json', () => {
    fs.writeFileSync(CLASP_PATHS.clientCredsLocal, randomString());
    const result = runClasp(['login', '--creds', `${CLASP_PATHS.clientCredsLocal}`, '--no-localhost']);
    fs.removeSync(CLASP_PATHS.clientCredsLocal);
    expect(result.stderr).to.contain(ERROR.BAD_CREDENTIALS_FILE);
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});
