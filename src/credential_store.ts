import path from 'path';
import dotf from 'dotf';
import {Dotfile} from 'dotf';
import {Credentials, JWTInput} from 'google-auth-library';
import {ClaspError} from './clasp-error.js';
import {Conf} from './conf.js';

type StoredCredential = JWTInput & Credentials;

// Initial .clasprc.json format, single credential per file
type V1LocalFileFormat = {
  token?: {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };
  oauth2ClientSettings?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  isLocalCreds?: boolean;
};

type V1GlobalFileFormat = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  exprity_date?: number;
};

// Clasp 3.x format, support for named credentials
type V3FileFormat = {
  tokens?: Record<string, StoredCredential | undefined>;
};

type FileContents = V1LocalFileFormat & V1GlobalFileFormat & V3FileFormat;

export interface CredentialStore {
  save(user: string, credentials: StoredCredential): Promise<void>;
  load(user: string): Promise<StoredCredential | null>;
}

export class FileCredentialStore implements CredentialStore {
  private dotfile: Dotfile;
  constructor() {
    const filePath = Conf.get().auth;
    const {dir, base} = path.parse(filePath!);
    if (!base.startsWith('.')) {
      throw new ClaspError('Project file must start with a dot (i.e. .clasp.json)');
    }
    this.dotfile = dotf(dir || '.', base.slice(1));
  }

  async save(user: string, credentials?: StoredCredential) {
    let store: FileContents = {};
    if (await this.dotfile.exists()) {
      store = await this.dotfile.read();
    }
    if (!store.tokens) {
      store.tokens = {};
    }
    store.tokens[user] = credentials;
    await this.dotfile.write(store);
  }

  async load(user: string): Promise<StoredCredential | null> {
    if (!(await this.dotfile.exists())) {
      return null;
    }
    const store: FileContents = await this.dotfile.read();
    const credentials = store.tokens?.[user] as StoredCredential;
    if (credentials) {
      return credentials;
    }
    if (user !== 'default') {
      return null;
    }
    if (hasLegacyLocalCredentials(store)) {
      // Support previous un
      return {
        type: 'authorized_user',
        ...store.token,
        client_id: store.oauth2ClientSettings?.clientId,
        client_secret: store.oauth2ClientSettings?.clientSecret,
      };
    }
    if (hasLegacyGlobalCredentials(store)) {
      return {
        type: 'authorized_user',
        access_token: store.access_token,
        refresh_token: store.refresh_token,
        expiry_date: store.exprity_date,
        token_type: store.token_type,
        client_id: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
        client_secret: 'v6V3fKV_zWU7iw1DrpO1rknX',
      };
    }
    return null;
  }
}

function hasLegacyLocalCredentials(store: FileContents) {
  return store.token && store.oauth2ClientSettings;
}

function hasLegacyGlobalCredentials(store: FileContents) {
  return !!store.access_token;
}
