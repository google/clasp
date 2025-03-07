import {dirname} from 'path';
import {fileURLToPath} from 'url';
import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';
import {readPackageUpSync} from 'read-pkg-up';

import {CLASP_USAGE, IS_PR} from './constants.js';
import {cleanup, runClasp, setup} from './functions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = readPackageUpSync({cwd: __dirname});

describe.skip('Test --help for each function', () => {
  const expectHelp = (command: string, expected: string) => {
    const result = runClasp([command, '--help']);
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include(expected);
  };
  it('should run --help', () => expectHelp('run', 'Run a function in your Apps Scripts project'));
  it('should logs --help', () => expectHelp('logs', 'Shows the StackDriver logs'));
  it('should login --help', () => expectHelp('login', 'Log in to script.google.com'));
  it('should logout --help', () => expectHelp('logout', 'Log out'));
  it('should create --help', () => expectHelp('create', 'Create a script'));
  it('should clone --help', () => expectHelp('clone', 'Clone a project'));
  it('should pull --help', () => expectHelp('pull', 'Fetch a remote project'));
  it('should push --help', () => expectHelp('push', 'Update the remote project'));
  it('should status --help', () => expectHelp('status', 'Lists files that will be pushed by clasp'));
  it('should open --help', () => expectHelp('open', 'Open a script'));
  it('should deployments --help', () => expectHelp('deployments', 'List deployment ids of a script'));
  it('should undeploy --help', () => expectHelp('undeploy', 'Undeploy a deployment of a project'));
  it('should versions --help', () => expectHelp('versions', 'List versions of a script'));
  it('should version --help', () => expectHelp('version', 'Creates an immutable version of the script'));
  it('should list --help', () => expectHelp('list', 'List App Scripts projects'));
  it('should apis --help', () => expectHelp('apis', 'List, enable, or disable APIs'));
  it('should help --help', () => expectHelp('help', 'Display help'));
});

describe('Test clasp version and versions function', () => {
  before(function () {
    if (IS_PR) {
      this.skip();
    }
    setup();
  });
  let versionNumber = 0;
  it('should prompt for version description', () => {
    const result = runClasp(['version']);
    expect(result.stdout).to.contain('Created version');
  });
  it('should create a new version correctly', () => {
    const result = runClasp(['version', 'xxx']);
    versionNumber = Number(result.stdout.slice(result.stdout.lastIndexOf(' '), -2));
    expect(versionNumber).to.be.greaterThan(0);
  });
  // TODO: this test needs to be updated
  it.skip('should list versions correctly', () => {
    const result = runClasp(['versions']);
    expect(result.stdout).to.contain('Versions');
    if (versionNumber) expect(result.stdout).to.contain(`${versionNumber} - `);
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});

describe('Test variations of clasp help', () => {
  const expectHelp = (variation: string) => {
    const result = runClasp([variation]);
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include(CLASP_USAGE);
  };
  it('should show help for clasp help', () => expectHelp('help'));
  it('should show help for clasp --help', () => expectHelp('--help'));
  it('should show help for clasp -h', () => expectHelp('-h'));
});

describe('Test variations of clasp --version', () => {
  const expectVersion = (variation: string) => {
    const result = runClasp([variation]);
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include(manifest ? manifest.packageJson.version : 'unknown');
  };
  it('should show version for clasp --version', () => expectVersion('--version'));
  it('should show version for clasp -v', () => expectVersion('-v'));
});

describe('Test unknown functions', () => {
  it('should show version correctly', () => {
    const result = runClasp(['unknown']);
    expect(result.stderr).to.contain('Unknown command');
    expect(result.status).to.equal(1);
  });
});
