  import * as os from 'os';
import * as path from 'path';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { describe, it } from 'mocha';
import * as tmp from 'tmp';
import { getFileType } from './../src/files';
import { getAPIFileType, getScriptURL, saveProjectId } from './../src/utils.js';
const { spawnSync } = require('child_process');
const TEST_CODE_JS = 'function test() { Logger.log(\'test\'); }';
const TEST_JSON = '{"timeZone": "America/New_York"}';
const CLASP = (os.type() === 'Windows_NT') ? 'clasp.cmd' : 'clasp';
const isPR = process.env.TRAVIS_PULL_REQUEST;

describe('Test help for each function', () => {
  it('should output help for run command', () => {
    const result = spawnSync(
      CLASP, ['run', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Run a function in your Apps Scripts project');
  });
  it('should output help for logs command', () => {
    const result = spawnSync(
      CLASP, ['logs', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Shows the StackDriver logs');
  });
  it('should output help for login command', () => {
    const result = spawnSync(
      CLASP, ['login', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Log in to script.google.com');
  });
  it('should output help for logout command', () => {
    const result = spawnSync(
      CLASP, ['logout', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Log out');
  });
  it('should output help for create command', () => {
    const result = spawnSync(
      CLASP, ['create', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Create a script');
  });
  it('should output help for clone command', () => {
    const result = spawnSync(
      CLASP, ['clone', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Clone a project');
  });
  it('should output help for pull command', () => {
    const result = spawnSync(
      CLASP, ['pull', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Fetch a remote project');
  });
  it('should output help for push command', () => {
    const result = spawnSync(
      CLASP, ['push', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Update the remote project');
  });
  it('should output help for status command', () => {
    const result = spawnSync(
      CLASP, ['status', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Lists files that will be pushed by clasp');
  });
  it('should output help for open command', () => {
    const result = spawnSync(
      CLASP, ['open', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Open a script');
  });
  it('should output help for deployments command', () => {
    const result = spawnSync(
      CLASP, ['deployments', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('List deployment ids of a script');
  });
  it('should output help for undeploy command', () => {
    const result = spawnSync(
      CLASP, ['undeploy', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Undeploy a deployment of a project');
  });
  it('should output help for redeploy command', () => {
    const result = spawnSync(
      CLASP, ['redeploy', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Update a deployment');
  });
  it('should output help for versions command', () => {
    const result = spawnSync(
      CLASP, ['versions', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('List versions of a script');
  });
  it('should output help for version command', () => {
    const result = spawnSync(
      CLASP, ['version', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Creates an immutable version of the script');
  });
  it('should output help for list command', () => {
    const result = spawnSync(
      CLASP, ['list', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('List App Scripts projects');
  });
  it('should output help for apis command', () => {
    const result = spawnSync(
      CLASP, ['apis', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('List, enable, or disable apis');
  });
  it('should output help for help command', () => {
    const result = spawnSync(
      CLASP, ['help', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Display help');
  });
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
});

describe('Test clasp create <title> function', () => {
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
    const settings = JSON.parse(fs.readFileSync('.clasp.json', 'utf8'));
    fs.removeSync('.clasp.json');
    const result = spawnSync(
      CLASP, ['clone', 'non-existing-project'], { encoding: 'utf8' },
    );
    expect(result.stderr).to.contain('> Did you provide the correct scriptId?');
    expect(result.status).to.equal(1);
    fs.writeFileSync('.clasp.json', JSON.stringify(settings));
  });
});

describe('Test clasp pull function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
  });
  it('should pull an existing project correctly', () => {
    const result = spawnSync(
      CLASP, ['pull'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp push function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
  });
  it('should push local project correctly', () => {
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
  it('should return non-0 exit code when push failed', () => {
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
});

describe('Test clasp status function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
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
    expect(resultJson.untrackedFiles).to.have.members(['shouldBeIgnored', 'should/alsoBeIgnored']);
    expect(resultJson.filesToPush).to.have.members(['build/main.js', 'appsscript.json']);
  });
  // https://github.com/google/clasp/issues/67 - This test currently fails
  it.skip('should ignore dotfiles if the parent folder is ignored', () => {
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
      'node_modules/fsevents/build/Release/.deps/Release/.node.d']);
    expect(resultJson.filesToPush).to.have.members(['appsscript.json']);
  });
});

describe('Test clasp open function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
  });
  it('should open a project correctly', () => {
    const result = spawnSync(
      CLASP, ['open'], { encoding: 'utf8' },
    );
    //should open a browser with the project
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp deployments function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
  });
  it('should list deployments correctly', () => {
    const result = spawnSync(
      CLASP, ['deployments'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Deployment');
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp deploy function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
  });
  it('should deploy correctly', () => {
    const result = spawnSync(
      CLASP, ['deploy'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Created version ');
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp version and versions function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
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
});

describe('Test clasp clone function', () => {
  before(function() {
    if (isPR !== 'false') {
      this.skip();
    }
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
});

describe('Test getScriptURL function from utils', () => {
  it('should return the scriptURL correctly', () => {
    const url = getScriptURL('abcdefghijklmnopqrstuvwxyz');
    expect(url).to.equal('https://script.google.com/d/abcdefghijklmnopqrstuvwxyz/edit');
  });
});

describe('Test getFileType function from utils', () => {
  it('should return the lowercase file type correctly', () => {
    expect(getFileType('SERVER_JS')).to.equal('js');
    expect(getFileType('GS')).to.equal('gs');
    expect(getFileType('JS')).to.equal('js');
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

describe('Test saveProjectId function from utils', () => {
  it('should save the scriptId correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const isSaved = async () => {
      await saveProjectId('12345');
      const id = fs.readFileSync(path.join(__dirname, '/../.clasp.json'), 'utf8');
      expect(id).to.equal('{"scriptId":"12345"}');
    };
    expect(isSaved).to.not.equal(null);
  });
});

describe('Test clasp apis functions', () => {
  it('should list apis correctly', () => {
    const result = spawnSync(
      'clasp', ['apis', 'list'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('abusiveexperiencereport   - abusiveexperiencereport:v1');
    expect(result.stdout).to.contain('youtubereporting          - youtubereporting:v1');
  });
  it('should enable apis correctly', () => {
    const result = spawnSync(
      'clasp', ['apis', 'enable'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('In development...');
  });
  it('should disable apis correctly', () => {
    const result = spawnSync(
      'clasp', ['apis', 'disable'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('In development...');
  });
  it('should error with unknown subcommand', () => {
    const result = spawnSync(
      'clasp', ['apis', 'unknown'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('Unknown command "apis unknown"');
  });
});

describe('Test clasp logout function', () => {
  it('should logout correctly', () => {
    fs.writeFileSync('.clasprc.json', TEST_JSON);
    fs.writeFileSync(path.join(os.homedir(), '/.clasprc.json'), TEST_JSON);
    const result = spawnSync(
      CLASP, ['logout'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    const localDotExists = fs.existsSync('.clasprc.json');
    expect(localDotExists).to.equal(false);
    const dotExists = fs.existsSync('~/.clasprc.json');
    expect(dotExists).to.equal(false);
  });
});