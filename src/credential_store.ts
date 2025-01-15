import dotf from 'dotf';
import {Dotfile} from 'dotf';
import {JWTInput, Credentials} from 'google-auth-library';
import {Conf} from './conf.js';
import {ClaspError} from './clasp-error.js';
import path from 'path';

type StoredCredential = JWTInput & Credentials;

// Initial .clasprc.json format, single credential per file
type V1FileFormat = {
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

// Clasp 3.x format, support for named credentials
type V3FileFormat = {
  tokens?: Record<string, StoredCredential | undefined>;
};

type FileContents = V1FileFormat & V3FileFormat;

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
    this.dotfile.write(store);
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
    if (user === 'default' && hasLegacyCredentials(store)) {
      // Support previous un
      return {
        type: 'authorized_user',
        ...store.token,
        client_id: store.oauth2ClientSettings?.clientId,
        client_secret: store.oauth2ClientSettings?.clientSecret,
      };
    }
    return null;
  }
}

function hasLegacyCredentials(store: any) {
  return store.token && store.oauth2ClientSettings;
}
