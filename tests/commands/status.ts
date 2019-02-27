import { expect } from 'chai';
import * as fs from 'fs-extra';
import { describe, it } from 'mocha';
const { spawnSync } = require('child_process');
import * as tmp from 'tmp';
import * as path from 'path';

import {
  CLASP,
  TEST_APPSSCRIPT_JSON,
  TEST_CODE_JS,
} from '../constants';

import {
  cleanup,
  setup,
} from '../functions';

describe('Test clasp status function', () => {
  before(setup);
  function setupTmpDirectory(filepathsAndContents: Array<{ file: string, data: string }>) {
    fs.ensureDirSync('tmp');
    const tmpdir = tmp.dirSync({ unsafeCleanup: true, dir: 'tmp/', keep: false }).name;
    filepathsAndContents.forEach(({ file, data }) => {
      fs.outputFileSync(path.join(tmpdir, file), data);
    });
    return tmpdir;
  }
  it('should respect globs and negation rules', () => {
    const tmpdir = setupTmpDirectory([
      { file: '.claspignore', data: '**/**\n!build/main.js\n!appsscript.json' },
      { file: 'build/main.js', data: TEST_CODE_JS },
      { file: 'appsscript.json', data: TEST_APPSSCRIPT_JSON },
      { file: 'shouldBeIgnored', data: TEST_CODE_JS },
      { file: 'should/alsoBeIgnored', data: TEST_CODE_JS },
    ]);
    spawnSync(CLASP, ['create', '[TEST] clasp status'], { encoding: 'utf8', cwd: tmpdir });
    const result = spawnSync(CLASP, ['status', '--json'], { encoding: 'utf8', cwd: tmpdir });
    expect(result.status).to.equal(0);
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members([
      '.claspignore', // TODO Should these be untracked?
      'should/alsoBeIgnored',
      'shouldBeIgnored',
    ]);
    expect(resultJson.filesToPush).to.have.members(['build/main.js', 'appsscript.json']);
  });
  it('should ignore dotfiles if the parent folder is ignored', () => {
    const tmpdir = setupTmpDirectory([
      { file: '.claspignore', data: '**/node_modules/**\n**/**\n!appsscript.json' },
      { file: 'appsscript.json', data: TEST_APPSSCRIPT_JSON },
      { file: 'node_modules/fsevents/build/Release/.deps/Release/.node.d', data: TEST_CODE_JS },
    ]);
    spawnSync(CLASP, ['create', '[TEST] clasp status'], { encoding: 'utf8', cwd: tmpdir });
    const result = spawnSync(CLASP, ['status', '--json'], { encoding: 'utf8', cwd: tmpdir });
    expect(result.status).to.equal(0);
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members([
      '.claspignore', // TODO Should these be untracked?
      'node_modules/fsevents/build/Release/.deps/Release/.node.d',
    ]);
    expect(resultJson.filesToPush).to.have.members(['appsscript.json']);
  });
  it('should respect globs and negation rules when rootDir given', () => {
    const tmpdir = setupTmpDirectory([
      { file: '.clasp.json', data: '{ "scriptId":"1234", "rootDir":"dist" }' },
      { file: '.claspignore', data: '**/**\n!dist/build/main.js\n!dist/appsscript.json' },
      { file: 'dist/build/main.js', data: TEST_CODE_JS },
      { file: 'dist/appsscript.json', data: TEST_APPSSCRIPT_JSON },
      { file: 'dist/shouldBeIgnored', data: TEST_CODE_JS },
      { file: 'dist/should/alsoBeIgnored', data: TEST_CODE_JS },
    ]);
    spawnSync(CLASP, ['create', '[TEST] clasp status'], { encoding: 'utf8', cwd: tmpdir });
    const result = spawnSync(CLASP, ['status', '--json'], { encoding: 'utf8', cwd: tmpdir });
    expect(result.status).to.equal(0);
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members([
      '**/**',
      '!dist/build/main.js',
      '!dist/appsscript.json']);
    expect(resultJson.filesToPush).to.have.members(['dist/build/main.js', 'dist/appsscript.json']);
    // TODO test with a rootDir with a relative directory like "../src"
  });
  after(cleanup);
});