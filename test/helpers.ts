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

import * as fs from 'fs';
import * as path from 'path';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

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
