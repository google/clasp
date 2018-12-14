import * as os from 'os';
import * as path from 'path';

import {
  rndStr,
} from './commonTestFunctions';

export const TEST_CODE_JS = 'function test() { Logger.log(\'test\'); }';
export const TEST_APPSSCRIPT: string = JSON.stringify({timeZone: 'America/New_York'});
export const CLASP = (os.type() === 'Windows_NT') ? 'clasp.cmd' : 'clasp';
export const isPR = process.env.TRAVIS_PULL_REQUEST;
export const SCRIPT_ID: string = process.env.SCRIPT_ID || '';
export const CLASP_USAGE = 'Usage: clasp <command> [options]';
export const claspSettingsLocalPath = '.clasp.json'; // path.join('./', '.clasp.json');
export const claspRcGlobalPath = path.join(os.homedir(), '.clasprc.json');
export const claspRcLocalPath = '.clasprc.json'; // path.join('./', '.clasprc.json');
export const clientCredsLocalPath = 'client_credentials.json'; // path.join('./', 'client_credentials.json');

export const CLASP_SETTINGS: string = JSON.stringify({
  scriptId: process.env.SCRIPT_ID,
  projectId: process.env.PROJECT_ID,
});

export const FAKE_CLASPRC: string = JSON.stringify({
  access_token: rndStr(),
  refresh_token: rndStr(),
  scope: 'https://www.googleapis.com/auth/script.projects',
  token_type: 'Bearer',
  expiry_date: (new Date()).getTime(),
});

export const FAKE_CLASPRC_LOCAL: string = JSON.stringify({
  token: FAKE_CLASPRC,
  oauth2ClientSettings: {
    clientId: `${rndStr()}.apps.googleusercontent.com`,
    clientSecret: rndStr(),
  },
});

export const CLASP_SETTINGS_FAKE_PROJECTID: string = JSON.stringify({
  scriptId: process.env.SCRIPT_ID,
  projectId: `project-id-${rndStr()}`,
});

export const FAKE_CLIENT_CREDS: string = JSON.stringify({
  installed: {
    client_id: `${rndStr()}.apps.googleusercontent.com`,
    client_secret: rndStr(),
  },
});

export const INVALID_CLIENT_CREDS: string = JSON.stringify({
  installed: {
    client_id: `${rndStr()}.apps.googleusercontent.com`,
  },
});
