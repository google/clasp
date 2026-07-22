// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file contains tests for the 'validateOptionInt' option-parsing helper.

import {expect} from 'chai';
import {InvalidOptionArgumentError} from 'commander';
import {describe, it} from 'mocha';
import {validateOptionInt} from '../../src/commands/validate.js';

describe('validateOptionInt', function () {
  describe('no bounds given', function () {
    it('parses a plain integer string', function () {
      expect(validateOptionInt('42')).to.equal(42);
    });

    it('throws InvalidOptionArgumentError for a non-numeric string', function () {
      expect(() => validateOptionInt('abc')).to.throw(InvalidOptionArgumentError);
    });

    it('throws for a decimal / non-integer value', function () {
      expect(() => validateOptionInt('3.5')).to.throw(InvalidOptionArgumentError);
    });
  });

  describe('with startInclusive / endInclusive bounds', function () {
    it('accepts a value inside the bounds', function () {
      expect(validateOptionInt('50', 0, 100)).to.equal(50);
    });

    it('accepts the lower bound exactly (inclusive)', function () {
      expect(validateOptionInt('0', 0, 65535)).to.equal(0);
    });

    it('accepts the upper bound exactly (inclusive)', function () {
      expect(validateOptionInt('65535', 0, 65535)).to.equal(65535);
    });

    it('throws when below startInclusive', function () {
      expect(() => validateOptionInt('-1', 0, 65535)).to.throw(InvalidOptionArgumentError);
    });

    it('throws when above endInclusive', function () {
      expect(() => validateOptionInt('70000', 0, 65535)).to.throw(InvalidOptionArgumentError);
    });
  });

  describe('falsy/empty value', function () {
    it('returns NaN without throwing when val is an empty string', function () {
      // The `if (val)` guard in the source skips validation entirely for
      // falsy input — asserting this so it stays intentional, not accidental.
      expect(Number.isNaN(validateOptionInt(''))).to.be.true;
    });
  });
});
