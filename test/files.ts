import {expect} from 'chai';
import {describe, it} from 'mocha';
import path from 'path';

import {isValidFileName} from '../src/files.js';

describe('Test files isValidFileName function', () => {
  const validFileName = 'testFile';
  const validJSONFileName = 'appsscript.json';
  const invalidNodeModulesFileName = 'node_modules/@types';
  const invalidFileNameInIgnoreMatches = 'ignoredFile';
  const validJSONFileType = 'JSON';
  const validJSFileType = 'SERVER_JS';
  const validHTMLFileType = 'HTML';
  const invalidFileType = 'JAVA';
  const validRootDir = './';
  const validNormalizedName = path.join(validRootDir, validJSONFileName);
  const validIgnoreMatches = ['ignoredFile', 'anotherFile'];

  // Disable a couple of linting rules just for these tests
  it('should return true for valid combinations of input', () => {
    expect(
      isValidFileName(validFileName, validJSFileType, validRootDir, validNormalizedName, validIgnoreMatches)
    ).to.equal(true);
    expect(
      isValidFileName(validFileName, validHTMLFileType, validRootDir, validNormalizedName, validIgnoreMatches)
    ).to.equal(true);
    expect(
      isValidFileName(validJSONFileName, validJSONFileType, validRootDir, validNormalizedName, validIgnoreMatches)
    ).to.equal(true);
  });
  it('should return false for invalid combinations of input', () => {
    expect(
      isValidFileName(
        invalidNodeModulesFileName,
        validJSFileType,
        validRootDir,
        validNormalizedName,
        validIgnoreMatches
      )
    ).to.equal(false);
    expect(
      isValidFileName(
        invalidFileNameInIgnoreMatches,
        validJSFileType,
        validRootDir,
        validNormalizedName,
        validIgnoreMatches
      )
    ).to.equal(false);
    expect(
      isValidFileName(validFileName, invalidFileType, validRootDir, validNormalizedName, validIgnoreMatches)
    ).to.equal(false);
  });
});
