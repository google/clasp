const expect = require('chai').expect;
const spawnSync = require('child_process').spawnSync;
fs = require('fs');

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
        expect(result.stdout).to.include('Shows the StackDriver Logs');
    });

});


describe('Test clasp list', () => {

    it('should list clasp projects correctly', () => {
        const result = spawnSync(
            'clasp', ['list'], { encoding : 'utf8' }
         );
        //at least one project exists (all projects begin with this URL)
        expect(result.stdout).to.contain('https://script.google.com/d/');
        expect(result.status).to.equal(0);
    });

});

describe.skip('Test clasp create', () => {

    it('should create new Untitled project correctly', () => {
        spawnSync('rm', ['.clasp.json']);
            const result = spawnSync(
                'clasp', ['create'], { encoding : 'utf8' }
            );
    
        expect(result.stdout).to.contain('Created new script: https://script.google.com/d/')
        expect(result.status).to.equal(0);
     });
});

describe('Test clasp clone', () => {

    //make sure to set the CLONE_ID in Travis
    it('should clone project correctly', () => {
        const result = spawnSync(
            'clasp', ['clone', process.env.CLONE_ID], { encoding : 'utf8' }
        );

        expect(result.stdout).to.contain('Cloned');
        expect(result.stdout).to.contain('files.');
        expect(result.status).to.equal(0);
    });

});

describe('Test clasp pull', () => {

    //Should use current project
    it('should pull correctly', () => {
        const result = spawnSync(
            'clasp', ['pull'], { encoding : 'utf8' }
        );
        expect(result.stdout).to.contain('Cloned');
        expect(result.stdout).to.contain('files.');
        expect(result.status).to.equal(0);
    });

});

describe('Test clasp push', () => {
    //must have .claspignore (to ignore index.js and whatnot)
    it('should push correctly', () => {
        const result = spawnSync(
            'clasp', ['push'], { encoding : 'utf8' }
        );
        expect(result.stdout).to.contain('Pushed');
        expect(result.stdout).to.contain('files.');
        expect(result.status).to.equal(0);
    });
});

//skipping this because it opens web page
describe.skip('Test clasp open', () => {
    it('should open correctly', () => {
        const result = spawnSync(
            'clasp', ['open'], { encoding : 'utf8' }
        );
        expect(result.status).to.equal(0);
    });
});

describe('Test clasp deployments', () => {
    it('should list deployments correctly', () => {
        const result = spawnSync(
            'clasp', ['deployments'], { encoding : 'utf8' }
        );
        expect(result.status).to.equal(0);
    });
});

describe('Test clasp deploy', () => {
    it('should deploy correctly', () => {
        const result = spawnSync(
            'clasp', ['deploy'], { encoding : 'utf8' }
        );
        expect(result.stdout).to.contain('Created version ');
        expect(result.status).to.equal(0);
    });
});

//this must come last or be skipped because it deletes the
//credentials
describe.skip('Test clasp logout', () => {

  it('should logout correctly', async () => {
      const result = spawnSync(
        'clasp', ['logout'], { encoding : 'utf8' }
      );
      expect(result.status).to.equal(0);
      expect(result.stdout).to.include('You are logged out now.');

      const dotExists = fs.existsSync('/.clasprc.json');
      expect(dotExists).to.equal(false);
    });
    
});




