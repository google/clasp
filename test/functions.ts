/* eslint-disable unicorn/prevent-abbreviations */
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import {
  CLASP_PATHS,
  CLASP_SETTINGS,
  TEST_APPSSCRIPT_JSON_WITH_RUN_API,
  TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API,
} from './constants';

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
export const rndStr = () => Math.random().toString(36).slice(2);

/**
 * backup clasp settings. Use `restoreSettings()` to restore these.
 */
export const backupSettings = () => {
  if (fs.existsSync(CLASP_PATHS.rcGlobal)) {
    fs.copyFileSync(CLASP_PATHS.rcGlobal, `${CLASP_PATHS.rcGlobal}~`);
  }
  if (fs.existsSync(CLASP_PATHS.rcLocal)) {
    fs.copyFileSync(CLASP_PATHS.rcLocal, `${CLASP_PATHS.rcLocal}~`);
  }
  if (fs.existsSync(CLASP_PATHS.settingsLocal)) {
    fs.copyFileSync(CLASP_PATHS.settingsLocal, `${CLASP_PATHS.settingsLocal}~`);
  }
};

/**
 * restore clasp settings backuped up using `backupSettings()`
 */
export const restoreSettings = () => {
  if (fs.existsSync(`${CLASP_PATHS.rcGlobal}~`)) {
    fs.renameSync(`${CLASP_PATHS.rcGlobal}~`, CLASP_PATHS.rcGlobal);
  }
  if (fs.existsSync(`${CLASP_PATHS.rcLocal}~`)) {
    fs.renameSync(`${CLASP_PATHS.rcLocal}~`, CLASP_PATHS.rcLocal);
  }
  if (fs.existsSync(`${CLASP_PATHS.settingsLocal}~`)) {
    fs.renameSync(`${CLASP_PATHS.settingsLocal}~`, CLASP_PATHS.settingsLocal);
  }
};

/**
 * create a temporary directory and its content, then return its path as a string
 *
 * @param {Array<{ file: string, data: string }} filepathsAndContents directory content (files)
 */
export function setupTmpDirectory(filepathsAndContents: Array<{file: string; data: string}>) {
  fs.ensureDirSync('tmp');
  const tmpdir = tmp.dirSync({unsafeCleanup: true, dir: 'tmp/', keep: false}).name;
  filepathsAndContents.forEach(({file, data}) => {
    fs.outputFileSync(path.join(tmpdir, file), data);
  });
  return tmpdir;
}
