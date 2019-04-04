import { expect } from 'chai';
import { describe, it } from 'mocha';

import {
  cleanup,
  setup,
} from './functions';

import {
  ERROR,
  getValidJSON,
} from '../src/utils';

describe('Test getValidJSON function', () => {
  before(setup);
  it('should parse valid params and throw exception for invalid params', () => {
    const validExampleJSONString = JSON.stringify({ param: 'value' });
    const invalidExampleJSONString = 'badString';
    expect(getValidJSON(validExampleJSONString)).to.eql(JSON.parse(validExampleJSONString));
    expect(() => getValidJSON(invalidExampleJSONString)).to.throw(ERROR.INVALID_JSON);
  });
  after(cleanup);
});