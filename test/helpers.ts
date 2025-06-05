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

/**
 * @fileoverview This file contains helper utilities and custom Chai assertions
 * used across the `clasp` test suite to simplify test setup and assertions.
 */

import * as fs from 'fs';
import * as path from 'path';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

/**
 * Registers custom Chai assertions and plugins used in the test suite.
 * This function should be called once before running tests that use these extensions.
 */
export function useChaiExtensions(): void {
  use(chaiAsPromised); // Adds support for asserting promises.
  use(chaiFileExists); // Adds the custom 'realFile' assertion.
}

// Augment Chai's Assertion interface for TypeScript to recognize the custom 'realFile' method.
declare global {
  namespace Chai {
    interface Assertion {
      /**
       * Asserts that the subject (a string path) points to an existing file on the filesystem.
       * @example expect("path/to/my/file.txt").to.be.a.realFile();
       */
      realFile(): Assertion;
    }
  }
}

/**
 * Custom Chai assertion plugin to check if a given path string points to an existing file.
 * @param chai The Chai instance.
 * @param utils Chai utility functions.
 *
 * Usage: `expect(filepathString).to.be.a.realFile();`
 */
export function chaiFileExists(chai: Chai.ChaiStatic, utils: Chai.ChaiUtils): void {
  const Assertion = chai.Assertion;

  Assertion.addMethod('realFile', function (this: Chai.AssertionStatic): void {
    // `this` refers to the Chai Assertion instance.
    // `utils.flag(this, 'object')` gets the value being asserted (the file path).
    const filePath: string = utils.flag(this, 'object');

    // First, ensure the subject is a string.
    new Assertion(filePath, 'File path for .realFile assertion must be a string.').is.a('string');

    const absolutePath: string = path.resolve(filePath); // Resolve to an absolute path for robustness.

    // Perform the assertion.
    this.assert(
      fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(),
      // Message if assertion fails (file does not exist or is not a file).
      `expected "#{this}" to be an existing file (path: ${absolutePath})`,
      // Message if assertion passes but was negated (e.g., expect().to.not.be.a.realFile()).
      `expected "#{this}" to not be an existing file (path: ${absolutePath})`,
    );
  });
}
