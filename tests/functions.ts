import * as fs from 'fs-extra';
import {
  CLASP_SETTINGS,
  claspPaths,
  TEST_APPSSCRIPT_JSON,
} from './constants';

const copyFileSync = require('fs-copy-file-sync');

export const cleanup = () => {
  fs.removeSync('.clasp.json');
  fs.removeSync('.claspignore');
  fs.removeSync('Code.js');
  fs.removeSync('appsscript.json');
};

export const setup = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS);
  fs.writeFileSync('appsscript.json', TEST_APPSSCRIPT_JSON);
};

export const rndStr = () => Math.random().toString(36).substr(2);

export const backupSettings = () => {
  // fs.copyFileSync isn't supported in Node 6/7
  if (fs.existsSync(claspPaths.rcGlobal)) {
    copyFileSync(claspPaths.rcGlobal, `${claspPaths.rcGlobal}~`);
  }
  if (fs.existsSync(claspPaths.rcLocal)) {
    copyFileSync(claspPaths.rcLocal, `${claspPaths.rcLocal}~`);
  }
  if (fs.existsSync(claspPaths.settingsLocal)) {
    copyFileSync(claspPaths.settingsLocal, `${claspPaths.settingsLocal}~`);
  }
};

export const restoreSettings = () => {
  if (fs.existsSync(`${claspPaths.rcGlobal}~`)) {
    fs.renameSync(`${claspPaths.rcGlobal}~`, claspPaths.rcGlobal);
  }
  if (fs.existsSync(`${claspPaths.rcLocal}~`)) {
    fs.renameSync(`${claspPaths.rcLocal}~`, claspPaths.rcLocal);
  }
  if (fs.existsSync(`${claspPaths.settingsLocal}~`)) {
    fs.renameSync(`${claspPaths.settingsLocal}~`, claspPaths.settingsLocal);
  }
};
