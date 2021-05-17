import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import {
  CLASP_PATHS,
  CLASP_SETTINGS,
  TEST_APPSSCRIPT_JSON_WITH_RUN_API,
  TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API,
} from './constants.js';

/** basic cleanup after tests */
export const cleanup = () => {
  fs.removeSync('.clasp.json');
  fs.removeSync('.claspignore');
  fs.removeSync('Code.js');
  fs.removeSync('appsscript.json');
};

/** basic setup for tests */
export const setup = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS.valid);
  fs.writeFileSync('appsscript.json', TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API);
};

/** setup for tests not using the run API */
export const setupWithoutGCPProject = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS.validWithoutProjectId);
  fs.writeFileSync('appsscript.json', TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API);
};

/** setup for tests using the run API */
export const setupWithRunManifest = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS.valid);
  fs.writeFileSync('appsscript.json', TEST_APPSSCRIPT_JSON_WITH_RUN_API);
};

/** produce a pseudo random string */
export const randomString = () => Math.random().toString(36).slice(2);

function copyFileIfExists(src: string, dest: string) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}
/**
 * backup clasp settings. Use `restoreSettings()` to restore these.
 */
export const backupSettings = () => {
  const files = [CLASP_PATHS.rcGlobal, CLASP_PATHS.rcLocal, CLASP_PATHS.settingsLocal];
  files.forEach(path => copyFileIfExists(path, `${path}~`));
};

/**
 * restore clasp settings backuped up using `backupSettings()`
 */
export const restoreSettings = () => {
  const files = [CLASP_PATHS.rcGlobal, CLASP_PATHS.rcLocal, CLASP_PATHS.settingsLocal];
  files.forEach(path => copyFileIfExists(`${path}~`, path));
};

/**
 * create a temporary directory and its content, then return its path as a string
 *
 * @param {Array<{ file: string, data: string }} filepathsAndContents directory content (files)
 */
export function setupTemporaryDirectory(filepathsAndContents: Array<{file: string; data: string}>) {
  const tmpdir = tmp.dirSync({unsafeCleanup: true, keep: false}).name;
  filepathsAndContents.forEach(({file, data}) => {
    fs.outputFileSync(path.join(tmpdir, file), data);
  });
  return tmpdir;
}
