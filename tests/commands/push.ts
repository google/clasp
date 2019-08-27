import { spawnSync } from 'child_process';
import { expect } from 'chai';
import fs from 'fs-extra';
import { describe, it } from 'mocha';
import { CLASP, TEST_CODE_JS, TEST_PAGE_HTML } from '../constants';
import { cleanup, setup } from '../functions';

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
  before(setup);
  it('should push local project correctly', () => {
    fs.writeFileSync('Code.js', TEST_CODE_JS);
    fs.writeFileSync('page.html', TEST_PAGE_HTML);
    const result = spawnSync(
      CLASP, ['push'], { encoding: 'utf8', input: 'y' },
    );
    expect(result.stdout).to.contain('Pushed');
    expect(result.stdout).to.contain('Code.js');
    expect(result.stdout).to.contain('page.html');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.be.oneOf([null, 0]); // TODO: investigate why nodejs 12 exit code is null
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
  after(cleanup);
});
