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

// This file provides helper functions and custom Chai assertions for use in
// the test suite, such as checking for file existence.

import * as fs from 'fs';
import * as path from 'path';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

/**
 * Registers custom Chai extensions used in the test suite.
 * This includes `chai-as-promised` for easier promise testing and
 * the custom `realFile` assertion.
 */
export function useChaiExtensions() {
  use(chaiAsPromised);
  use(chaiFileExists);
}

declare global {
  namespace Chai {
    interface Assertion {
      realFile(): Assertion; // Optional expectedPath if you want to allow it
    }
  }
}

/**
 * A custom Chai assertion plugin to check if a path exists and is a file.
 * Adds the `.realFile` assertion to Chai.
 *
 * Example usage:
 * ```
 * expect('path/to/your/file.txt').to.be.a.realFile();
 * ```
 * @param {Chai.ChaiStatic} chai - The Chai instance.
 * @param {Chai.ChaiUtils} utils - Chai utility functions.
 */
export function chaiFileExists(chai: Chai.ChaiStatic, utils: Chai.ChaiUtils): void {
  const Assertion = chai.Assertion;

  Assertion.addMethod('realFile', function (): void {
    const obj: string = utils.flag(this, 'object');
    const absolutePath: string = path.resolve(obj);

    new Assertion(obj).is.a('string', 'expected path to be a string');

    this.assert(
      fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(),
      `expected ${obj} to exist as a real file`,
      `expected ${obj} to not exist as a real file`,
    );
  });
}
