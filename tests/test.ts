import * as os from 'os';
import * as path from 'path';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { describe, it } from 'mocha';
import * as tmp from 'tmp';
import { getFileType } from './../src/files';
import {
  ERROR,
  PROJECT_NAME,
  getAPIFileType,
  URL,
  getWebApplicationURL,
  saveProject,
  getDefaultProjectName,
} from './../src/utils.js';
const { spawnSync } = require('child_process');
const TEST_CODE_JS = 'function test() { Logger.log(\'test\'); }';
const TEST_JSON = '{"timeZone": "America/New_York"}';
const CLASP = (os.type() === 'Windows_NT') ? 'clasp.cmd' : 'clasp';
const isPR = process.env.TRAVIS_PULL_REQUEST;
const CLASP_SETTINGS: string = JSON.stringify({
  scriptId: process.env.SCRIPT_ID,
});
const CLASP_USAGE = 'Usage: clasp <command> [options]';

const cleanup = () => {
  fs.removeSync('.clasp.json');
};

const setup = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS);
};

describe('Test --help for each function', () => {
  const expectHelp = (command: string, expected: string) => {
    const result = spawnSync(
      CLASP, [command, '--help'], { encoding : 'utf8' },
    );
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
  it('should redeploy --help', () => expectHelp('redeploy', 'Update a deployment'));
  it('should versions --help', () => expectHelp('versions', 'List versions of a script'));
  it('should version --help', () => expectHelp('version', 'Creates an immutable version of the script'));
  it('should list --help', () => expectHelp('list', 'List App Scripts projects'));
  it('should apis --help', () => expectHelp('apis', 'List, enable, or disable apis'));
  it('should help --help', () => expectHelp('help', 'Display help'));
});

describe('Test clasp list function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
  });
  it('should list clasp projects correctly', () => {
    const result = spawnSync(
      CLASP, ['list'], { encoding: 'utf8' },
    );
    // Every project starts with this base URL, thus
    // using clasp list should at least contain this
    // in its output.
    expect(result.stdout).to.contain('https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp create function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
  });
  it('should prompt for a project name correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      CLASP, ['create'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Give a script title:');
  });
  it('should not prompt for project name', () => {
    fs.writeFileSync('.clasp.json', '');
    const result = spawnSync(
      CLASP, ['create'], { encoding: 'utf8' },
    );
    expect(result.stderr).to.contain('Project file (.clasp.json) already exists.');
  });
  after(cleanup);
});

describe.skip('Test clasp create <title> function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
  });
  it('should create a new project named <title> correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      CLASP, ['create', 'myTitle'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Created new script: https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp clone <scriptId> function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  it('should clone an existing project correctly', () => {
    const settings = JSON.parse(fs.readFileSync('.clasp.json', 'utf8'));
    fs.removeSync('.clasp.json');
    const result = spawnSync(
      CLASP, ['clone', settings.scriptId], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  it('should give an error on a non-existing project', () => {
    fs.removeSync('./.clasp.json');
    const result = spawnSync(
      CLASP, ['clone', 'non-existing-project'], { encoding: 'utf8' },
    );
    expect(result.stderr).to.contain('> Did you provide the correct scriptId?');
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});

describe('Test clasp pull function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  it('should pull an existing project correctly', () => {
    const result = spawnSync(
      CLASP, ['pull'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});

describe('Test clasp push function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  it.skip('should push local project correctly', () => {
    fs.removeSync('.claspignore');
    fs.writeFileSync('Code.js', TEST_CODE_JS);
    fs.writeFileSync('appsscript.json', TEST_JSON);
    fs.writeFileSync('.claspignore', '**/**\n!Code.js\n!appsscript.json');
    const result = spawnSync(
      CLASP, ['push'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Pushed');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
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

describe('Test clasp status function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
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
      { file: 'appsscript.json', data: TEST_JSON },
      { file: 'shouldBeIgnored', data: TEST_CODE_JS },
      { file: 'should/alsoBeIgnored', data: TEST_CODE_JS },
    ]);
    spawnSync(CLASP, ['create', '[TEST] clasp status'], { encoding: 'utf8', cwd: tmpdir  });
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
      { file: 'appsscript.json', data: TEST_JSON },
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
      { file: 'dist/appsscript.json', data: TEST_JSON },
      { file: 'dist/shouldBeIgnored', data: TEST_CODE_JS },
      { file: 'dist/should/alsoBeIgnored', data: TEST_CODE_JS },
    ]);
    spawnSync(CLASP, ['create', '[TEST] clasp status'], { encoding: 'utf8', cwd: tmpdir  });
    const result = spawnSync(CLASP, ['status', '--json'], { encoding: 'utf8', cwd: tmpdir });
    console.log(result.stdout);
    console.log(result.stderr);
    expect(result.status).to.equal(0);
    const resultJson = JSON.parse(result.stdout);
    expect(resultJson.untrackedFiles).to.have.members(['dist/shouldBeIgnored', 'dist/should/alsoBeIgnored']);
    expect(resultJson.filesToPush).to.have.members(['dist/build/main.js', 'dist/appsscript.json']);
    // TODO test with a rootDir with a relative directory like "../src"
  });
  after(cleanup);
});

describe('Test clasp open function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  it('should open a project correctly', () => {
    const result = spawnSync(
      CLASP, ['open'], { encoding: 'utf8' },
    );
    //should open a browser with the project
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});

describe('Test clasp deployments function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  it('should list deployments correctly', () => {
    const result = spawnSync(
      CLASP, ['deployments'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Deployment');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});

describe('Test clasp deploy function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  // Could fail to to maximum deployments (20)
  // TODO: skip test if at maximum
  it('should deploy correctly', () => {
    const result = spawnSync(
      CLASP, ['deploy'], { encoding: 'utf8' },
    );
    if (result.stderr) {
      expect(result.stderr).to.contain('Unable to deploy;');
      expect(result.stderr).to.contain('Scripts may only have up to 20 versioned deployments at a time.');
      expect(result.status).to.equal(1);
    } else {
      expect(result.stdout).to.contain('Created version ');
      expect(result.status).to.equal(0);
    }
  });
  after(cleanup);
});

describe('Test clasp version and versions function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  let versionNumber = '';
  it('should create new version correctly', () => {
    const result = spawnSync(
      CLASP, ['version'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Created version ');
    expect(result.status).to.equal(0);
    versionNumber = result.stdout.substring(result.stdout.lastIndexOf(' '), result.stdout.length - 2);
    it('should list versions correctly', () => {
      const result = spawnSync(
        CLASP, ['versions'], { encoding: 'utf8' },
      );
      expect(result.stdout).to.contain('Versions');
      expect(result.stdout).to.contain(versionNumber + ' - ');
      expect(result.status).to.equal(0);
    });
  });
  after(cleanup);
});

describe('Test clasp clone function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  it('should prompt for which script to clone correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      CLASP, ['clone'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Clone which script?');
  });
  it('should give an error if .clasp.json already exists', () => {
    fs.writeFileSync('.clasp.json', '');
    const result = spawnSync(
      CLASP, ['clone'], { encoding: 'utf8' },
    );
    expect(result.stderr).to.contain('Project file (.clasp.json) already exists.');
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});

describe('Test URL helper from utils', () => {
  it('should return the scriptURL correctly', () => {
    const url = URL.SCRIPT('abcdefghijklmnopqrstuvwxyz');
    expect(url).to.equal('https://script.google.com/d/abcdefghijklmnopqrstuvwxyz/edit');
  });
});

describe('Test getWebApplicationURL function from utils', () => {
  it('should return the scriptURL correctly', () => {
    const url = getWebApplicationURL({
      entryPoints: [
        {
          entryPointType: 'WEB_APP',
          webApp: {
            url: 'https://script.google.com/macros/s/abcdefghijklmnopqrstuvwxyz/exec',
          },
        },
      ],
    });
    expect(url).to.equal('https://script.google.com/macros/s/abcdefghijklmnopqrstuvwxyz/exec');
  });
});

describe('Test getDefaultProjectName function from utils', () => {
  it('should return the current directory name correctly', () => {
    expect(getDefaultProjectName()).to.equal('Clasp');
  });
});

describe('Test getFileType function from utils', () => {
  it('should return the lowercase file type correctly', () => {
    expect(getFileType('SERVER_JS')).to.equal('js');
    expect(getFileType('GS')).to.equal('gs');
    expect(getFileType('JS')).to.equal('js');
    expect(getFileType('HTML')).to.equal('html');
  });

  it('should return the specified file extention if the file type is SERVER_JS', () => {
    expect(getFileType('SERVER_JS', 'gs')).to.equal('gs');
    expect(getFileType('GS', 'js')).to.equal('gs');
    expect(getFileType('JS', 'gs')).to.equal('js');
    expect(getFileType('HTML', 'js')).to.equal('html');
  });
});

describe('Test getAPIFileType function from utils', () => {
  it('should return the uppercase file type correctly', () => {
    expect(getAPIFileType('file.GS')).to.equal('SERVER_JS');
    expect(getAPIFileType('file.JS')).to.equal('SERVER_JS');
    expect(getAPIFileType('file.js')).to.equal('SERVER_JS');
    expect(getAPIFileType('file.jsx')).to.equal('JSX');
    expect(getAPIFileType('file.js.html')).to.equal('HTML');
  });
});

describe('Test saveProject function from utils', () => {
  it('should save the scriptId correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const isSaved = async () => {
      await saveProject('12345');
      const id = fs.readFileSync(path.join(__dirname, '/../.clasp.json'), 'utf8');
      expect(id).to.equal('{"scriptId":"12345"}');
    };
    expect(isSaved).to.not.equal(null);
  });

  it('should save the scriptId, rootDir correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const isSaved = async () => {
      await saveProject('12345', './dist');
      const id = fs.readFileSync(path.join(__dirname, '/../.clasp.json'), 'utf8');
      expect(id).to.equal('{"scriptId":"12345","rootDir":"./dist"}');
    };
    expect(isSaved).to.not.equal(null);
  });
});

describe('Test clasp apis functions', () => {
  it('should list apis correctly', () => {
    const result = spawnSync(
      CLASP, ['apis', 'list'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('abusiveexperiencereport   - abusiveexperiencereport:v1');
    expect(result.stdout).to.contain('youtubereporting          - youtubereporting:v1');
  });
  it('should enable apis correctly', () => {
    const result = spawnSync(
      CLASP, ['apis', 'enable'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('In development...');
  });
  it('should disable apis correctly', () => {
    const result = spawnSync(
      CLASP, ['apis', 'disable'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('In development...');
  });
  it('should show suggestions for using clasp apis', () => {
    const result = spawnSync(
      CLASP, ['apis'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`Try:
    clasp apis list`);
  });
  it('should error with unknown subcommand', () => {
    const result = spawnSync(
      CLASP, ['apis', 'unknown'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain(`Unknown command "${PROJECT_NAME} apis unknown"`);
  });
});

describe('Test clasp logs function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
    setup();
  });
  it('should prompt for logs setup', () => {
    const result = spawnSync(
      CLASP, ['logs'], { encoding: 'utf8' },  // --setup is default behaviour
    );
    expect(result.stdout).to.contain('What is your GCP projectId?');
  });
  after(cleanup);
});

describe('Test clasp logout function', () => {
  it('should logout local *only* if local credentails', () => {
    fs.writeFileSync(path.join('./', '.clasprc.json'), TEST_JSON);
    fs.writeFileSync(path.join(os.homedir(), '.clasprc.json'), TEST_JSON);
    const result = spawnSync(
      CLASP, ['logout'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    const localDotExists = fs.existsSync(path.join('./', '.clasprc.json'));
    expect(localDotExists).to.equal(false);
    const dotExists = fs.existsSync(path.join(os.homedir(), '.clasprc.json'));
    expect(dotExists).to.equal(true);
  });

  it('should logout global (default) if no local credentials', () => {
    const result = spawnSync(
      CLASP, ['logout'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    const dotExists = fs.existsSync(path.join(os.homedir(), '.clasprc.json'));
    expect(dotExists).to.equal(false);
  });
});

describe('Test variations of clasp help', () => {
  const expectHelp = (variation: string) => {
    const result = spawnSync(
      CLASP, [variation], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include(CLASP_USAGE);
  };
  it('should show help for clasp help', () => expectHelp('help'));
  it('should show help for clasp --help', () => expectHelp('--help'));
  it('should show help for clasp -h', () => expectHelp('-h'));
});

describe('Test variations of clasp --version', () => {
  const expectVersion = (variation: string) => {
    const result = spawnSync(
      CLASP, [variation], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include(require('./../package.json').version);
  };
  it('should show version for clasp --version', () => expectVersion('--version'));
  it('should show version for clasp -v', () => expectVersion('-v'));
});

describe('Test unknown functions', () => {
  it('should show version correctly', () => {
    const result = spawnSync(
      CLASP, ['unknown'], { encoding: 'utf8' },
    );
    expect(result.stderr).to.contain(`🤔  Unknown command "${PROJECT_NAME} unknown"`);
    expect(result.status).to.equal(1);
  });
});

describe('Test all functions while logged out', () => {
  const expectNoCredentials = (command: string) => {
    const result = spawnSync(
      CLASP, [command], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.include(ERROR.NO_CREDENTIALS);
  };
  it('should fail to list (no credentials)', () => expectNoCredentials('list'));
  it('should fail to clone (no credentials)', () => expectNoCredentials('clone'));
  it('should fail to push (no credentials)', () => expectNoCredentials('push'));
  it('should fail to deployments (no credentials)', () => expectNoCredentials('deployments'));
  it('should fail to deploy (no credentials)', () => expectNoCredentials('deploy'));
  it('should fail to version (no credentials)', () => expectNoCredentials('version'));
  it('should fail to versions (no credentials)', () => expectNoCredentials('versions'));

  // TODO: all test should have same order of checks
  // and should all return ERROR.NO_CREDENTIALS
  it('should fail to pull (no .clasp.json file)', () => {
    const result = spawnSync(
      CLASP, ['pull'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    // Should be ERROR.NO_CREDENTIALS
    // see: https://github.com/google/clasp/issues/278
    expect(result.stderr).to.contain(ERROR.SETTINGS_DNE);
  });
  it('should fail to open (no .clasp.json file)', () => {
    const result = spawnSync(
      CLASP, ['open'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    // Should be ERROR.NO_CREDENTIALS
    // see: https://github.com/google/clasp/issues/278
    expect(result.stderr).to.contain(ERROR.SETTINGS_DNE);
  });
  // Skipping this, see: https://github.com/tj/commander.js/issues/840
  it.skip('should fail to redeploy (missing argument version)', () => {
    const result = spawnSync(
      CLASP, ['redeploy', '1234'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('error: missing required argument \'version\'');
  });
  // Skipping this, see: https://github.com/tj/commander.js/issues/840
  it.skip('should fail to redeploy (missing argument deploymentId)', () => {
    const result = spawnSync(
      CLASP, ['redeploy'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('error: missing required argument \'deploymentId\'');
  });
  it('should fail to show logs (no .clasp.json file)', () => {
    const result = spawnSync(
      CLASP, ['logs'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    // Should be ERROR.NO_CREDENTIALS
    // see: https://github.com/google/clasp/issues/278
    expect(result.stderr).to.contain(ERROR.SETTINGS_DNE);
  });
});