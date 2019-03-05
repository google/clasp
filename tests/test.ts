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
  cleanup,
  setup,
} from './functions';

import {
  CLASP,
  CLASP_SETTINGS,
  CLASP_USAGE,
  CLASP_PATHS,
  IS_PR,
  SCRIPT_ID,
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
    expect(result.stdout).to.contain(LOG.ASK_PROJECT_ID);
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
