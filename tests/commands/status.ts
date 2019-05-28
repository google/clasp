import { spawnSync } from 'child_process';
import * as path from 'path';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { describe, it } from 'mocha';
import * as tmp from 'tmp';
import {
  CLASP,
  TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API,
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
      { file: 'appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API },
      { file: 'shouldBeIgnored', data: TEST_CODE_JS },
      { file: 'should/alsoBeIgnored', data: TEST_CODE_JS },
    ]);
    spawnSync(
      CLASP,
      ['create', '--type', 'Standalone', '--title', '"[TEST] clasp status"'],
      { encoding: 'utf8', cwd: tmpdir },
    );
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
      { file: 'appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API },
      { file: 'node_modules/fsevents/build/Release/.deps/Release/.node.d', data: TEST_CODE_JS },
    ]);
    spawnSync(
      CLASP,
      ['create', '--type', 'Standalone', '--title', '"[TEST] clasp status"'],
      { encoding: 'utf8', cwd: tmpdir },
    );
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
      { file: '.claspignore', data: '**/**\n!build/main.js\n!appsscript.json' },
      { file: 'dist/build/main.js', data: TEST_CODE_JS },
      { file: 'dist/appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API },
      { file: 'dist/shouldBeIgnored', data: TEST_CODE_JS },
      { file: 'dist/should/alsoBeIgnored', data: TEST_CODE_JS },
    ]);
    // spawnSync(CLASP, ['create', '[TEST] clasp status'], { encoding: 'utf8', cwd: tmpdir });
    const result = spawnSync(CLASP, ['status', '--json'], { encoding: 'utf8', cwd: tmpdir });
    expect(result.status).to.equal(0);
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members([
      'dist/should/alsoBeIgnored',
      'dist/shouldBeIgnored']);
    expect(resultJson.filesToPush).to.have.members(['dist/build/main.js', 'dist/appsscript.json']);
  });
  it('should respect globs and negation rules when relative rootDir given', () => {
    const tmpdir = setupTmpDirectory([
      { file: 'src/.clasp.json', data: '{ "scriptId":"1234", "rootDir":"../build" }' },
      { file: 'src/.claspignore', data: '**/**\n!main.js\n!appsscript.json' },
      { file: 'build/main.js', data: TEST_CODE_JS },
      { file: 'build/appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API },
      { file: 'build/shouldBeIgnored', data: TEST_CODE_JS },
      { file: 'build/should/alsoBeIgnored', data: TEST_CODE_JS },
    ]);
    // spawnSync(CLASP, ['create', '[TEST] clasp status'], { encoding: 'utf8', cwd: tmpdir + '/src' });
    const result = spawnSync(CLASP, ['status', '--json'], { encoding: 'utf8', cwd: tmpdir + '/src' });
    expect(result.status).to.equal(0);
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members([
      '../build/should/alsoBeIgnored',
      '../build/shouldBeIgnored']);
    expect(resultJson.filesToPush).to.have.members(['../build/main.js', '../build/appsscript.json']);
  });
  after(cleanup);
});