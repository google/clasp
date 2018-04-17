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

/**
TODO: Test these commands and configs.

# Commands:
clasp;
clasp login';
clasp login --no-localhost;
clasp logout;
clasp create "myTitle"
clasp clone <scriptId>
clasp pull
echo '// test' >> index.js && clasp push
clasp open
clasp deployments
clasp deploy [version] [description]
clasp redeploy <deploymentId> <version> <description>
clasp version [description]
clasp versions

# Configs
- .js and .gs files
- Ignored files
*/
