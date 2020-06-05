import {expect} from 'chai';
import {after, before, describe, it} from 'mocha';

import {ERROR} from '../src/messages';
import {getValidJSON} from '../src/utils';
import {cleanup, setup} from './functions';

describe('Test getValidJSON function', () => {
  before(setup);
  it('should parse valid params and throw exception for invalid params', () => {
    const validExampleJSONString = JSON.stringify({param: 'value'});
    const invalidExampleJSONString = 'badString';
    expect(getValidJSON(validExampleJSONString)).to.eql(JSON.parse(validExampleJSONString));
    expect(() => getValidJSON(invalidExampleJSONString)).to.throw(ERROR.INVALID_JSON);
  });
  after(cleanup);
});
