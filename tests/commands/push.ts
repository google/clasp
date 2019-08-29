import { spawnSync } from 'child_process';
import { expect } from 'chai';
import fs from 'fs-extra';
import { describe, it } from 'mocha';
import {
  CLASP,
  CLASP_SETTINGS,
  TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API,
  TEST_CODE_JS,
  TEST_PAGE_HTML,
} from '../constants';
import { cleanup, setup, setupTmpDirectory } from '../functions';

describe('Test clasp push function', () => {
  before(setup);
  it('should push local project correctly', () => {
    fs.writeFileSync('Code.js', TEST_CODE_JS);
    fs.writeFileSync('.claspignore', '**/**\n!Code.js\n!appsscript.json');
    const result = spawnSync(
      CLASP, ['push'], { encoding: 'utf8', input: 'y' },
    );
    expect(result.stdout).to.contain('Pushed');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  // TODO: this test needs to be updated
  it.skip('should return non-0 exit code when push failed', () => {
    fs.writeFileSync('.claspignore', '**/**\n!Code.js\n!appsscript.json\n!unexpected_file');
    fs.writeFileSync('unexpected_file', TEST_CODE_JS);
    const result = spawnSync(
      CLASP, ['push'], { encoding: 'utf8' },
    );
    expect(result.stderr).to.contain('Invalid value at');
    expect(result.stderr).to.contain('UNEXPECTED_FILE');
    expect(result.stderr).to.contain('Files to push were:');
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});

describe('Test clasp push with no `.claspignore`', () => {
  // before(setup);
  it('should push local project correctly', () => {
    const tmpdir = setupTmpDirectory([
      { file: '.clasp.json', data: CLASP_SETTINGS.valid },
      { file: 'appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API },
      { file: 'Code.js', data: TEST_CODE_JS },
      { file: 'page.html', data: TEST_PAGE_HTML },
    ]);
    const testDir = spawnSync('ls', {
      encoding: 'utf8',
      cwd: tmpdir,
    });
    expect(testDir.stdout).to.contain('Code.js');
    expect(testDir.stdout).to.contain('page.html');
    // fs.writeFileSync('Code.js', TEST_CODE_JS);
    // fs.writeFileSync('page.html', TEST_PAGE_HTML);
    const result = spawnSync(CLASP, ['push'], {
      encoding: 'utf8',
      cwd: tmpdir,
      input: 'y',
    });
    // const result = spawnSync(
    //   CLASP, ['push'], { encoding: 'utf8', input: 'y' },
    // );
    expect(result.stdout).to.contain('Pushed');
    expect(result.stdout).to.contain('Code.js');
    expect(result.stdout).to.contain('page.html');
    expect(result.stdout).to.contain('files.');
    expect(result.stderr).to.equal('');
    // expect(result.status).to.be.oneOf([null, 0]); // TODO: investigate why nodejs 12 exit code is null
    expect(result.status).to.equal(0);
  });
  // TODO: this test needs to be updated
  it.skip('should return non-0 exit code when push failed', () => {
    fs.writeFileSync('unexpected_file', TEST_CODE_JS);
    const result = spawnSync(
      CLASP, ['push'], { encoding: 'utf8' },
    );
    expect(result.stderr).to.contain('Invalid value at');
    expect(result.stderr).to.contain('UNEXPECTED_FILE');
    expect(result.stderr).to.contain('Files to push were:');
    expect(result.status).to.equal(1);
  });
  // after(cleanup);
});
