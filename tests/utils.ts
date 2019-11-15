import { expect } from 'chai';
import { describe, it } from 'mocha';

import {
  cleanup,
  setup,
} from './functions';

import {
  ERROR,
  getValidJSON,
  isValidEmail
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

describe('Test utils isValidEmail function', () => {
  const validEmail = 'user@example.com';
  const invalidEmail = 'user@example';

  it('should return true for valid combinations of input', () => {
    expect(isValidEmail(validEmail)).to.be.true;
  });

  it('should return false for invalid combinations of input', () => {
    expect(isValidEmail(invalidEmail)).to.be.false;
  });
});