import {expect} from 'chai';
import {spawnSync} from 'child_process';
import {after, before, describe, it} from 'mocha';

import {CLASP, TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API, TEST_CODE_JS} from '../constants.js';
import {cleanup, setup, setupTemporaryDirectory} from '../functions.js';

describe('Test clasp status function', () => {
  before(setup);
  it('should respect globs and negation rules', () => {
    const tmpdir = setupTemporaryDirectory([
      {file: '.clasp.json', data: '{ "scriptId":"1234" }'},
      {file: '.claspignore', data: '**/**\n!build/main.js\n!appsscript.json'},
      {file: 'build/main.js', data: TEST_CODE_JS},
      {file: 'appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API},
      {file: 'shouldBeIgnored', data: TEST_CODE_JS},
      {file: 'should/alsoBeIgnored', data: TEST_CODE_JS},
    ]);
    const result = spawnSync(CLASP, ['status', '--json'], {encoding: 'utf8', cwd: tmpdir});
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members([
      '.clasp.json',
      '.claspignore', // TODO Should these be untracked?
      'should/alsoBeIgnored',
      'shouldBeIgnored',
    ]);
    expect(resultJson.filesToPush).to.have.members(['build/main.js', 'appsscript.json']);
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
    // TODO: cleanup by del/rimraf tmpdir
  });
  it('should ignore dotfiles if the parent folder is ignored', () => {
    const tmpdir = setupTemporaryDirectory([
      {file: '.clasp.json', data: '{ "scriptId":"1234" }'},
      {file: '.claspignore', data: '**/node_modules/**\n**/**\n!appsscript.json'},
      {file: 'appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API},
      {file: 'node_modules/fsevents/build/Release/.deps/Release/.node.d', data: TEST_CODE_JS},
    ]);
    const result = spawnSync(CLASP, ['status', '--json'], {encoding: 'utf8', cwd: tmpdir});
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members([
      '.clasp.json',
      '.claspignore', // TODO Should these be untracked?
      'node_modules/fsevents/build/Release/.deps/Release/.node.d',
    ]);
    expect(resultJson.filesToPush).to.have.members(['appsscript.json']);
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
    // TODO: cleanup by del/rimraf tmpdir
  });
  it('should respect globs and negation rules when rootDir given', () => {
    const tmpdir = setupTemporaryDirectory([
      {file: '.clasp.json', data: '{ "scriptId":"1234", "rootDir":"dist" }'},
      {file: '.claspignore', data: '**/**\n!build/main.js\n!appsscript.json'},
      {file: 'dist/build/main.js', data: TEST_CODE_JS},
      {file: 'dist/appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API},
      {file: 'dist/shouldBeIgnored', data: TEST_CODE_JS},
      {file: 'dist/should/alsoBeIgnored', data: TEST_CODE_JS},
    ]);
    const result = spawnSync(CLASP, ['status', '--json'], {encoding: 'utf8', cwd: tmpdir});
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members(['dist/should/alsoBeIgnored', 'dist/shouldBeIgnored']);
    expect(resultJson.filesToPush).to.have.members(['dist/build/main.js', 'dist/appsscript.json']);
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
    // TODO: cleanup by del/rimraf tmpdir
  });
  it('should respect globs and negation rules when relative rootDir given', () => {
    const tmpdir = setupTemporaryDirectory([
      {file: 'src/.clasp.json', data: '{ "scriptId":"1234", "rootDir":"../build" }'},
      {file: 'src/.claspignore', data: '**/**\n!main.js\n!appsscript.json'},
      {file: 'build/main.js', data: TEST_CODE_JS},
      {file: 'build/appsscript.json', data: TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API},
      {file: 'build/shouldBeIgnored', data: TEST_CODE_JS},
      {file: 'build/should/alsoBeIgnored', data: TEST_CODE_JS},
    ]);
    const result = spawnSync(CLASP, ['status', '--json'], {encoding: 'utf8', cwd: tmpdir + '/src'});
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members(['../build/should/alsoBeIgnored', '../build/shouldBeIgnored']);
    expect(resultJson.filesToPush).to.have.members(['../build/main.js', '../build/appsscript.json']);
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
    // TODO: cleanup by del/rimraf tmpdir
  });
  after(cleanup);
});
