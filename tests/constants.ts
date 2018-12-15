import * as os from 'os';
import * as path from 'path';

import {
  rndStr,
} from './functions';
import { ClaspToken } from '../src/dotfile';
import { OAuth2ClientOptions } from 'google-auth-library';

// Sample files
export const TEST_CODE_JS = 'function test() { Logger.log(\'test\'); }';
export const TEST_APPSSCRIPT_JSON = JSON.stringify({timeZone: 'America/New_York'});

// Travis Env Variables
export const IS_PR: boolean = (process.env.TRAVIS_PULL_REQUEST === 'true');
export const SCRIPT_ID: string = process.env.SCRIPT_ID || '';
const PROJECT_ID: string = process.env.PROJECT_ID || '';
const HOME: string = process.env.HOME || '';

// Paths
export const claspPaths = {
  clientCredsLocal: 'client_credentials.json' as string,
  rcGlobal: path.join(HOME, '.clasprc.json') as string,
  rcLocal: '.clasprc.json' as string,
  settingsLocal: '.clasp.json' as string,
};

// Other constants
export const CLASP: string = (os.type() === 'Windows_NT') ? 'clasp.cmd' : 'clasp';
export const CLASP_USAGE = 'Usage: clasp <command> [options]';

const VALID_CLASP_SETTINGS = {
  scriptId: SCRIPT_ID as string,
  projectId: PROJECT_ID as string,
};

const INVALID_CLASP_SETTINGS = {
  scriptId: SCRIPT_ID as string,
  projectId: `project-id-${rndStr()}` as string,
};

export const CLASP_SETTINGS = {
  valid: JSON.stringify(VALID_CLASP_SETTINGS) as string,
  invalid: JSON.stringify(INVALID_CLASP_SETTINGS) as string,
};

const FAKE_CLASPRC_TOKEN = {
  access_token: rndStr() as string,
  refresh_token: rndStr() as string,
  scope: 'https://www.googleapis.com/auth/script.projects' as string,
  token_type: 'Bearer' as string,
  expiry_date: (new Date()).getTime() as number,
};

const oAuth2ClientOptions: OAuth2ClientOptions = {
  clientId: `${rndStr()}.apps.googleusercontent.com` as string,
  clientSecret: rndStr() as string,
};

const FAKE_CLASPRC_LOCAL: ClaspToken = {
  token: FAKE_CLASPRC_TOKEN,
  oauth2ClientSettings: oAuth2ClientOptions as OAuth2ClientOptions,
  isLocalCreds: true as boolean,
};

export const FAKE_CLASPRC = {
  local: JSON.stringify(FAKE_CLASPRC_LOCAL) as string,
  token: JSON.stringify(FAKE_CLASPRC_TOKEN) as string,
};

const FAKE_CLIENT_CREDS = {
  installed: {
    client_id: `${rndStr()}.apps.googleusercontent.com` as string,
    client_secret: rndStr() as string,
  },
};

const INVALID_CLIENT_CREDS = {
  installed: {
    client_id: `${rndStr()}.apps.googleusercontent.com` as string,
  },
};

export const CLIENT_CREDS = {
  fake: JSON.stringify(FAKE_CLIENT_CREDS) as string,
  invalid: JSON.stringify(INVALID_CLIENT_CREDS) as string,
};
