import * as fs from 'fs';
import * as path from 'path';

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
