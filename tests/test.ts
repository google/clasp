import * as path from 'path';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { describe, it } from 'mocha';
import { getAppsScriptFileName, getFileType } from './../src/files';
import {
  ERROR,
  LOG,
  getAPIFileType,
  getDefaultProjectName,
  getWebApplicationURL,
  saveProject,
} from './../src/utils';

import {
  backupSettings,
  cleanup,
  restoreSettings,
  rndStr,
  setup,
} from './functions';

import {
  CLASP,
  CLASP_SETTINGS,
  CLASP_USAGE,
  CLASP_PATHS,
  CLIENT_CREDS,
  FAKE_CLASPRC,
  IS_PR,
  SCRIPT_ID,
  TEST_APPSSCRIPT_JSON,
  TEST_CODE_JS,
} from './constants';

import {
  extractScriptId,
  URL,
} from './../src/urls';

const { spawnSync } = require('child_process');

describe('Test --help for each function', () => {
  const expectHelp = (command: string, expected: string) => {
    const result = spawnSync(
      CLASP, [command, '--help'], { encoding: 'utf8' },
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
  it('should versions --help', () => expectHelp('versions', 'List versions of a script'));
  it('should version --help', () => expectHelp('version', 'Creates an immutable version of the script'));
  it('should list --help', () => expectHelp('list', 'List App Scripts projects'));
  it('should apis --help', () => expectHelp('apis', 'List, enable, or disable APIs'));
  it('should help --help', () => expectHelp('help', 'Display help'));
});

describe('Test clasp list function', () => {
  before(function () {
    if (IS_PR) {
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
  before(function () {
    if (IS_PR) {
      this.skip();
    }
  });
  it('should prompt for a project name correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      CLASP, ['create'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain(LOG.CLONE_SCRIPT_QUESTION);
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
  before(function () {
    if (IS_PR) {
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
  before(function () {
    if (IS_PR) {
      this.skip();
    }
    setup();
  });
  it('should clone a project with scriptId correctly', () => {
    cleanup();
    const result = spawnSync(
      CLASP, ['clone', SCRIPT_ID], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
  it('should clone a project with scriptURL correctly', () => {
    cleanup();
    const result = spawnSync(
      CLASP, ['clone', URL.SCRIPT(SCRIPT_ID)], { encoding: 'utf8' },
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
    expect(result.stderr).to.contain(ERROR.SCRIPT_ID);
    expect(result.status).to.equal(1);
  });
  after(cleanup);
});

describe('Test extractScriptId function', () => {
  it('should return scriptId correctly', () => {
    expect(extractScriptId(SCRIPT_ID)).to.equal(SCRIPT_ID);
    expect(extractScriptId(URL.SCRIPT(SCRIPT_ID))).to.equal(SCRIPT_ID);
  });
});

describe('Test clasp pull function', () => {
  before(function () {
    if (IS_PR) {
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

describe('Test clasp open function', () => {
  before(function () {
    if (IS_PR) {
      this.skip();
    }
    setup();
  });
  it('should prompt for which deployment to open correctly', () => {
    const result = spawnSync(
      CLASP, ['open'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain(`Opening script: ${URL.SCRIPT(SCRIPT_ID)}`);
  });
  after(cleanup);
});

describe('Test URL utils function', () => {
  it('should create Script URL correctly', () => {
    const expectedUrl = `https://script.google.com/d/${SCRIPT_ID}/edit`;
    expect(URL.SCRIPT(SCRIPT_ID)).to.equal(expectedUrl);
  });
  it('should create Creds URL correctly', () => {
    const expectedURL = `https://console.developers.google.com/apis/credentials?project=${SCRIPT_ID}`;
    expect(URL.CREDS(SCRIPT_ID)).to.equal(expectedURL);
  });
});

describe('Test clasp deployments function', () => {
  before(function () {
    if (IS_PR) {
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
  before(function () {
    if (IS_PR) {
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
      const err1 = 'Scripts may only have up to 20 versioned deployments at a time';
      const err2 = 'Currently just one deployment can be created at a time';
      const re = `(?:${err1}|${err2})`;
      expect([result.stderr]).to.match(new RegExp(re));
      expect(result.status).to.equal(1);
    } else {
      expect(result.stdout).to.contain('Created version ');
      expect(result.status).to.equal(0);
    }
  });
  after(cleanup);
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
    const result = spawnSync(
      CLASP, ['version'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain(LOG.GIVE_DESCRIPTION);
    expect(result.status).to.equal(0);
  });
  it('should create a new version correctly', () => {
    const result = spawnSync(
      CLASP, ['version', 'xxx'], { encoding: 'utf8' },
    );
    versionNumber =
      Number(result.stdout.substring(result.stdout.lastIndexOf(' '), result.stdout.length - 2));
    expect(versionNumber).to.be.greaterThan(0);
  });
  it.skip('should list versions correctly', () => {
    const result = spawnSync(
      CLASP, ['versions'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Versions');
    if (versionNumber) expect(result.stdout).to.contain(versionNumber + ' - ');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});

describe('Test clasp clone function', () => {
  before(function () {
    if (IS_PR) {
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
  it('should prompt which project to clone and clone it', () => {
    cleanup();
    const result = spawnSync(
      CLASP, ['clone'], { encoding: 'utf8', input: '\n'},
    );
    expect(result.stdout).to.contain('Clone which script?');
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
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

describe('Test setting function', () => {
  before(function () {
    if (IS_PR) {
      this.skip();
    }
    setup();
  });
  it('should return current setting value', () => {
    const result = spawnSync(
      CLASP, ['setting', 'scriptId'], { encoding: 'utf8' },
    );

    expect(result.stdout).to.equal(process.env.SCRIPT_ID);
  });
  it('should update .clasp.json with provided value', () => {
    const result = spawnSync(
      CLASP, ['setting', 'scriptId', 'test'], { encoding: 'utf8' },
    );
    const fileContents = fs.readFileSync('.clasp.json', 'utf8');
    expect(result.stdout).to.contain('Updated "scriptId":');
    expect(result.stdout).to.contain('→ "test"');
    expect(fileContents).to.contain('"test"');
  });
  it('should error on unknown keys', () => {
    // Test getting
    let result = spawnSync(
      CLASP, ['setting', 'foo'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain(ERROR.UNKNOWN_KEY('foo'));

    // Test setting
    result = spawnSync(
      CLASP, ['setting', 'bar', 'foo'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain(ERROR.UNKNOWN_KEY('bar'));
  });
  after(cleanup);
});

describe('Test getAppsScriptFileName function from files', () => {
  it('should return the basename correctly', () => {
    expect(getAppsScriptFileName('./', 'appsscript.json')).to.equal('appsscript');
    expect(getAppsScriptFileName('', 'appsscript.json')).to.equal('appsscript');
    expect(getAppsScriptFileName('./dist', './dist/appsscript.json')).to.equal('appsscript');
    expect(getAppsScriptFileName('./dist', './dist/foo/Code.js')).to.equal('foo/Code');
  });
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
      await saveProject({scriptId: '12345'});
      const id = fs.readFileSync(path.join(__dirname, '/../.clasp.json'), 'utf8');
      expect(id).to.equal('{"scriptId":"12345"}');
    };
    expect(isSaved).to.not.equal(null);
  });

  it('should save the scriptId, rootDir correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const isSaved = async () => {
      await saveProject({scriptId: '12345', rootDir: './dist'});
      const id = fs.readFileSync(path.join(__dirname, '/../.clasp.json'), 'utf8');
      expect(id).to.equal('{"scriptId":"12345","rootDir":"./dist"}');
    };
    expect(isSaved).to.not.equal(null);
  });
});

describe('Test clasp apis functions', () => {
  before(function () {
    if (IS_PR) {
      this.skip();
    }
    setup();
  });
  it('should list apis correctly', () => {
    const result = spawnSync(
      CLASP, ['apis', 'list'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('# Currently enabled APIs:');
    expect(result.stdout).to.contain('# List of available APIs:');
  });
  it('should ask for an API when trying to enable', () => {
    const result = spawnSync(
      CLASP, ['apis', 'enable'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('An API name is required.');
  });
  it('should enable sheets', () => {
    const result = spawnSync(
      CLASP, ['apis', 'enable', 'sheets'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('Enabled sheets API.');
  });
  it('should give error message for non-existent API', () => {
    const result = spawnSync(
      CLASP, ['apis', 'enable', 'fakeApi'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('API fakeApi doesn\'t exist. Try \'clasp apis enable sheets\'.');
  });
  it('should ask for an API when trying to disable', () => {
    const result = spawnSync(
      CLASP, ['apis', 'disable'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain('An API name is required.');
  });
  it('should disable apis correctly', () => {
    const result = spawnSync(
      CLASP, ['apis', 'disable', 'sheets'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('Disabled sheets API.');
  });
  it('should show suggestions for using clasp apis', () => {
    const result = spawnSync(
      CLASP, ['apis'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain(`# Try these commands:
- clasp apis list
- clasp apis enable slides
- clasp apis disable slides`);
  });
  it('should error with unknown subcommand', () => {
    const result = spawnSync(
      CLASP, ['apis', 'unknown'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    expect(result.stderr).to.contain(`Unknown command`);
  });
  after(cleanup);
});

describe.skip('Test clasp logs function', () => {
  before(function () {
    if (IS_PR) {
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
  it('should prompt for logs setup', () => {
    const result = spawnSync(
      CLASP, ['logs', '--setup'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.contain('Open this link:');
    expect(result.stdout).to.include(`https://script.google.com/d/${SCRIPT_ID}/edit`);
    expect(result.stdout).to.contain('Go to *Resource > Cloud Platform Project...*');
    expect(result.stdout).to.include('and copy your projectId\n(including "project-id-")');
    expect(result.stdout).to.contain('What is your GCP projectId?');
  });
  after(cleanup);
});

describe('Test clasp login function', () => {
  before(function () {
    if (IS_PR) {
      this.skip();
    }
    setup();
  });
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

// Skipping for now because you still need to deploy function using GUI
describe.skip('Test clasp run function', () => {
  before(function () {
    if (IS_PR) {
      this.skip();
    }
    setup();
  });
  it('should prompt for project ID', () => {
    const result = spawnSync(
      CLASP, ['run', 'myFunction'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('What is your GCP projectId?');
  });
  it('should prompt to set up new OAuth client', () => {
    fs.writeFileSync(CLASP_PATHS.settingsLocal, CLASP_SETTINGS.invalid);
    const result = spawnSync(
      CLASP, ['run', 'myFunction'], { encoding: 'utf8' },
    );
    fs.removeSync(CLASP_PATHS.settingsLocal);
    expect(result.stdout)
      .to.contain('https://console.developers.google.com/apis/credentials?project=');
    expect(result.status).to.equal(0);
  });
  after(cleanup);
});

describe('Test variations of clasp help', () => {
  const expectHelp = (variation: string) => {
    const result = spawnSync(
      CLASP, [variation], { encoding: 'utf8' },
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
      CLASP, [variation], { encoding: 'utf8' },
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
    expect(result.stderr).to.contain(`Unknown command`);
    expect(result.status).to.equal(1);
  });
});

describe('Test all functions while logged out', () => {
  before(() => {
    if (fs.existsSync(CLASP_PATHS.rcGlobal)) fs.removeSync(CLASP_PATHS.rcGlobal);
    if (fs.existsSync(CLASP_PATHS.rcLocal)) fs.removeSync(CLASP_PATHS.rcLocal);
  });
  const expectNoCredentials = (command: string) => {
    const result = spawnSync(
      CLASP, [command], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(1);
    // expect(result.stderr).to.include(ERROR.NO_CREDENTIALS);
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
