import { describe, it } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
const { spawnSync } = require('child_process');
import { getScriptURL, getFileType } from './../src/utils.js';

describe('Test help for each function', () => {
  it('should output help for run command', () => {
    const result = spawnSync(
      'clasp', ['run', '--help'], { encoding : 'utf8' },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Run a function in your Apps Scripts project');
  });
  it('should output help for logs command', () => {
    const result = spawnSync(
      'clasp', ['logs', '--help'], { encoding : 'utf8', detached: true },
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Shows the StackDriver logs');
  });
});

describe.skip('Test clasp list function', () => {
  it('should list clasp projects correctly', () => {
    const result = spawnSync(
      'clasp', ['list'], { encoding: 'utf8' },
    );
    // Every project starts with this base URL, thus
    // using clasp list should at least contain this
    // in its output.
    expect(result.stdout).to.contain('https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp create function', () => {
  it('should prompt for a project name correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      'clasp', ['create'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('give a script title:');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp create <projectName> function', () => {
  it('should create a new project correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      'clasp', ['create', 'sampleProject'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Created new script: https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp create <title> function', () => {
  it('should create a new project named <title> correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      'clasp', ['create', 'myTitle'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Created new script: https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp clone <scriptId> function', () => {
  it('should clone an existing project correctly', () => {
    const settings = JSON.parse(fs.readFileSync('.clasp.json', 'utf8'));
    const result = spawnSync(
      'clasp', ['clone', settings.scriptId], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp pull function', () => {
  it('should pull an existing project correctly', () => {
    const result = spawnSync(
      'clasp', ['pull'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Cloned');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp push function', () => {
  it('should push local project correctly', () => {
    fs.writeFileSync('.claspignore', '**/**\n!Code.js\n!appsscript.json');
    const result = spawnSync(
      'clasp', ['push'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Pushed');
    expect(result.stdout).to.contain('files.');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp open function', () => {
  it('should open a project correctly', () => {
    const result = spawnSync(
      'clasp', ['open'], { encoding: 'utf8' },
    );
    //should open a browser with the project
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp clone function', () => {
  it('should prompt for which script to clone correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      'clasp', ['clone'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Clone which script?');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp deployments function', () => {
  it('should list deployments correctly', () => {
    const result = spawnSync(
      'clasp', ['deployments'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Deployments.');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp deploy function', () => {
  it('should deploy correctly', () => {
    const result = spawnSync(
      'clasp', ['deploy'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('Created version ');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test clasp versions function', () => {
  it('should list versions correctly', () => {
    const result = spawnSync(
      'clasp', ['versions'], { encoding: 'utf8' },
    );
    expect(result.stdout).to.contain('~ ');
    expect(result.stdout).to.contain(' Versions ~');
    expect(result.status).to.equal(0);
  });
});

describe.skip('Test getScriptURL function from utils', () => {
  it('should return the scriptURL correctly', () => {
    const url = getScriptURL('abcdefghijklmnopqrstuvwxyz');
    expect(url).to.equal('https://script.google.com/d/abcdefghijklmnopqrstuvwxyz/edit');
    const url2 = getScriptURL('1234567890abcdefg');
    expect(url2).to.equal('https://script.google.com/d/1234567890abcdefg/edit');
  });
});

describe.skip('Test getFileType function from utils', () => {
  it('should return the lowercase file type correctly', () => {
    const type = getFileType('SERVER_JS');
    expect(type).to.equal('js');
    const type2 = getFileType('GS');
    expect(type2).to.equal('gs');
    const type3 = getFileType('JS');
    expect(type3).to.equal('js');
  });
});

// Fails when you logged in using --ownkey flag
describe.skip('Test clasp logout function', () => {
  it('should logout correctly', () => {
    fs.writeFileSync('.clasprc.json', ' ');
    fs.writeFileSync('~/.clasprc.json', ' ');
    const result = spawnSync(
      'clasp', ['logout'], { encoding: 'utf8' },
    );
    expect(result.status).to.equal(0);
    const localDotExists = fs.existsSync('.clasprc.json');
    expect(localDotExists).to.equal(false);
    const dotExists = fs.existsSync('~/.clasprc.json');
    expect(dotExists).to.equal(false);
  });
});

/**
 * TODO: Test these commands and configs.
 *
 * # Commands:
 * [ ] clasp;
 * [ ] clasp login';
 * [ ] clasp login --no-localhost;
 * [x] clasp logout;
 * [x] clasp create "myTitle"
 * [x] clasp create <untitled>
 * [x] clasp list
 * [x] clasp clone <scriptId>
 * [x] clasp clone
 * [x] clasp pull
 * [x] clasp push
 * [ ] echo '// test' >> index.js && clasp push
 * [x] clasp open
 * [ ] clasp deployments
 * [ ] clasp deploy [version] [description]
 * [ ] clasp redeploy <deploymentId> <version> <description>
 * [ ] clasp version [description]
 * [x] clasp versions
 *
 * # Configs
 * - .js and .gs files
 * - Ignored files
 */