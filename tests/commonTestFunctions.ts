import * as fs from 'fs-extra';
import {
  claspRcGlobalPath,
  claspRcLocalPath,
  claspSettingsLocalPath,
} from './commonTestConstants';

const copyFileSync = require('fs-copy-file-sync');

const TEST_APPSSCRIPT: string = JSON.stringify({timeZone: 'America/New_York'});
const CLASP_SETTINGS: string = JSON.stringify({
  scriptId: process.env.SCRIPT_ID,
  projectId: process.env.PROJECT_ID,
});
export const cleanup = () => {
  fs.removeSync('.clasp.json');
  fs.removeSync('.claspignore');
  fs.removeSync('Code.js');
  fs.removeSync('appsscript.json');
};

export const setup = () => {
  fs.writeFileSync('.clasp.json', CLASP_SETTINGS);
  fs.writeFileSync('appsscript.json', TEST_APPSSCRIPT);
};

export const rndStr = () => Math.random().toString(36).substr(2);

export const backupSettings = () => {
  // fs.copyFileSync isn't supported in Node 6/7
  if (fs.existsSync(claspRcGlobalPath)) {
    copyFileSync(claspRcGlobalPath, `${claspRcGlobalPath}~`);
  }
  if (fs.existsSync(claspRcLocalPath)) {
    copyFileSync(claspRcLocalPath, `${claspRcLocalPath}~`);
  }
  if (fs.existsSync(claspSettingsLocalPath)) {
    copyFileSync(claspSettingsLocalPath, `${claspSettingsLocalPath}~`);
  }
};

export const restoreSettings = () => {
  if (fs.existsSync(`${claspRcGlobalPath}~`)) {
    fs.renameSync(`${claspRcGlobalPath}~`, claspRcGlobalPath);
  }
  if (fs.existsSync(`${claspRcLocalPath}~`)) {
    fs.renameSync(`${claspRcLocalPath}~`, claspRcLocalPath);
  }
  if (fs.existsSync(`${claspSettingsLocalPath}~`)) {
    fs.renameSync(`${claspSettingsLocalPath}~`, claspSettingsLocalPath);
  }
};
