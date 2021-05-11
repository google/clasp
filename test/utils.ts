import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {ERROR} from '../src/messages.js';
import {parseJsonOrDie} from '../src/utils.js';
import {cleanup, setup} from './functions.js';

describe('Test getValidJSON function', () => {
  before(setup);
  it('should parse valid params and throw exception for invalid params', () => {
    const validExampleJSONString = JSON.stringify({param: 'value'});
    const invalidExampleJSONString = 'badString';
    expect(parseJsonOrDie(validExampleJSONString)).to.eql(JSON.parse(validExampleJSONString));
    expect(() => parseJsonOrDie(invalidExampleJSONString)).to.throw(ERROR.INVALID_JSON);
  });
  after(cleanup);
});
