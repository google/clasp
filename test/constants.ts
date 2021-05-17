import os from 'os';
import path from 'path';

import {ClaspToken} from '../src/dotfile.js';
import {randomString} from './functions.js';

import type {OAuth2ClientOptions} from 'google-auth-library';

// Sample files
export const TEST_CODE_JS = "function test() { Logger.log('test'); }";
export const TEST_PAGE_HTML = '<html><body><p>hello there</p></body</html>';

export const TEST_APPSSCRIPT_JSON_WITHOUT_RUN_API = JSON.stringify({
  timeZone: 'America/Los_Angeles',
  dependencies: {},
  exceptionLogging: 'STACKDRIVER',
});

export const TEST_APPSSCRIPT_JSON_WITH_RUN_API = JSON.stringify({
  timeZone: 'America/Los_Angeles',
  dependencies: {},
  exceptionLogging: 'STACKDRIVER',
  executionApi: {
    access: 'MYSELF',
  },
});

// Travis Env Variables
export const IS_PR: boolean = process.env.CI === 'true';
export const SCRIPT_ID: string = process.env.SCRIPT_ID ?? '';
export const PROJECT_ID: string = process.env.PROJECT_ID ?? '';
export const PARENT_ID: string[] = [process.env.PROJECT_ID ?? ''];
const HOME: string = process.env.HOME ?? '';

// Paths
export const CLASP_PATHS = {
  clientCredsLocal: 'client_credentials.json',
  rcGlobal: path.join(HOME, '.clasprc.json'),
  rcLocal: '.clasprc.json',
  settingsLocal: '.clasp.json',
};

// Other constants
export const CLASP: string = os.type() === 'Windows_NT' ? 'clasp.cmd' : 'clasp';
export const CLASP_USAGE = 'Usage: clasp <command> [options]';

const VALID_CLASP_SETTINGS = {
  scriptId: SCRIPT_ID,
  projectId: PROJECT_ID,
  parentId: PARENT_ID,
};

const INVALID_CLASP_SETTINGS = {
  scriptId: SCRIPT_ID,
  projectId: `project-id-${randomString()}`,
};

const VALID_CLASP_SETTINGS_WITHOUT_PROJECT_ID = {
  scriptId: SCRIPT_ID,
};

export const CLASP_SETTINGS = {
  valid: JSON.stringify(VALID_CLASP_SETTINGS),
  invalid: JSON.stringify(INVALID_CLASP_SETTINGS),
  validWithoutProjectId: JSON.stringify(VALID_CLASP_SETTINGS_WITHOUT_PROJECT_ID),
};

const FAKE_CLASPRC_TOKEN = {
  access_token: randomString(),
  refresh_token: randomString(),
  scope: 'https://www.googleapis.com/auth/script.projects',
  token_type: 'Bearer',
  expiry_date: new Date().getTime(),
};

const oAuth2ClientOptions: OAuth2ClientOptions = {
  clientId: `${randomString()}.apps.googleusercontent.com`,
  clientSecret: randomString(),
};

const FAKE_CLASPRC_LOCAL: ClaspToken = {
  token: FAKE_CLASPRC_TOKEN,
  oauth2ClientSettings: oAuth2ClientOptions,
  isLocalCreds: true,
};

export const FAKE_CLASPRC = {
  local: JSON.stringify(FAKE_CLASPRC_LOCAL),
  token: JSON.stringify(FAKE_CLASPRC_TOKEN),
};

const FAKE_CLIENT_CREDS = {
  installed: {
    client_id: `${randomString()}.apps.googleusercontent.com`,
    client_secret: randomString(),
  },
};

const INVALID_CLIENT_CREDS = {
  installed: {
    client_id: `${randomString()}.apps.googleusercontent.com`,
  },
};

export const CLIENT_CREDS = {
  fake: JSON.stringify(FAKE_CLIENT_CREDS),
  invalid: JSON.stringify(INVALID_CLIENT_CREDS),
};
