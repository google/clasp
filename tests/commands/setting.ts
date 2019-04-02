import { expect } from 'chai';
import * as fs from 'fs-extra';
import { describe, it } from 'mocha';
const { spawnSync } = require('child_process');

import {
  CLASP,
} from '../constants';

import {
  cleanup,
  setup,
} from '../functions';

import { ERROR } from '../../src/utils';

describe('Test setting function', () => {
  before(setup);
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