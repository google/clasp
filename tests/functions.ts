import * as fs from 'fs-extra';
import {
  CLASP_SETTINGS,
  CLASP_PATHS,
  TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API,
  TEST_APPSSCRIPT_JSON_WITH_RUN_API,
} from './constants';

const copyFileSync = require('fs-copy-file-sync');

export const cleanup = () => {
  fs.removeSync('.clasp.json');
  fs.removeSync('.claspignore');
  fs.removeSync('Code.js');
  fs.removeSync('appsscript.json');
};

export const setup = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS.valid);
  fs.writeFileSync('appsscript.json', TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API);
};

export const setupWithoutGCPProject = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS.validWithoutProjectId);
  fs.writeFileSync('appsscript.json', TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API);
};

export const setupWithRunManifest = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS.valid);
  fs.writeFileSync('appsscript.json', TEST_APPSSCRIPT_JSON_WITH_RUN_API);
};

export const rndStr = () => Math.random().toString(36).substr(2);

export const backupSettings = () => {
  // fs.copyFileSync isn't supported in Node 6/7
  if (fs.existsSync(CLASP_PATHS.rcGlobal)) {
    copyFileSync(CLASP_PATHS.rcGlobal, `${CLASP_PATHS.rcGlobal}~`);
  }
  if (fs.existsSync(CLASP_PATHS.rcLocal)) {
    copyFileSync(CLASP_PATHS.rcLocal, `${CLASP_PATHS.rcLocal}~`);
  }
  if (fs.existsSync(CLASP_PATHS.settingsLocal)) {
    copyFileSync(CLASP_PATHS.settingsLocal, `${CLASP_PATHS.settingsLocal}~`);
  }
};

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
