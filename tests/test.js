const expect = require('chai').expect;
const spawnSync = require('child_process').spawnSync;

describe('Test help for each function', () => { 
  it('should output help for run command', () => {
    const result = spawnSync(
      'clasp', ['run', '--help'], { encoding : 'utf8' }
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Run a function in your Apps Scripts project');
  });
  it('should output help for logs command', () => {
    const result = spawnSync(
      'clasp', ['logs', '--help'], { encoding : 'utf8', detached: true }
    );
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('Shows the StackDriver logs');
  });
});

describe('Test clasp list function', () => {
  it('should list clasp projects correctly', () => {
    const result = spawnSync(
      'clasp', ['list'], { encoding: 'utf8' }
    );
    // Every project starts with this base URL, thus
    // using clasp list should at least contain this
    // in its output.
    expect(result.stdout).to.contain('https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});

describe('Test clasp create function', () => {
  it('should create a new project correctly', () => {
    spawnSync('rm', ['.clasp.json']);
    const result = spawnSync(
      'clasp', ['create'], { encoding: 'utf8' }
    );
    expect(result.stdout).to.contain('Created new script: https://script.google.com/d/');
    expect(result.status).to.equal(0);
  });
});


/**
TODO: Test these commands and configs.

# Commands:
[ ] clasp;
[ ] clasp login';
[ ] clasp login --no-localhost;
[ ] clasp logout;
[ ] clasp create "myTitle"
[x] clasp create <untitled>
[x] clasp list
[ ] clasp clone <scriptId>
[ ] clasp pull
[ ] echo '// test' >> index.js && clasp push
[ ] clasp open
[ ] clasp deployments
[ ] clasp deploy [version] [description]
[ ] clasp redeploy <deploymentId> <version> <description>
[ ] clasp version [description]
[ ] clasp versions

# Configs
- .js and .gs files
- Ignored files
*/
