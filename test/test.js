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
        expect(result.stdout).to.include('Shows the StackDriver Logs');
    });

});



