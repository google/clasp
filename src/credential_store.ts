import fs from 'fs';
import {Credentials, JWTInput} from 'google-auth-library';

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
  delete(user: string): Promise<void>;
  deleteAll(): Promise<void>;
  load(user: string): Promise<StoredCredential | null>;
}

export class FileCredentialStore implements CredentialStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async save(user: string, credentials?: StoredCredential) {
    const store: FileContents = this.readFile();
    if (!store.tokens) {
      store.tokens = {};
    }
    store.tokens[user] = credentials;
    this.writeFile(store);
  }

  async delete(user: string) {
    let store: FileContents = this.readFile();
    if (!store.tokens) {
      store.tokens = {};
    }
    store.tokens[user] = undefined;

    if (user === 'default') {
      // Remove legacy keys if default user
      store = {
        tokens: store.tokens,
      };
    }
    this.writeFile(store);
  }

  async deleteAll() {
    await this.writeFile({
      tokens: {},
    });
  }

  async delete(user: string) {
    let store: FileContents = this.readFile();
    if (!store.tokens) {
      store.tokens = {};
    }
    store.tokens[user] = undefined;

    if (user === 'default') {
      // Remove legacy keys if default user
      store = {
        tokens: store.tokens,
      };
    }
    this.writeFile(store);
  }

  async deleteAll() {
    await this.writeFile({
      tokens: {},
    });
  }

  async load(user: string): Promise<StoredCredential | null> {
    const store: FileContents = this.readFile();
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

  private readFile(): FileContents {
    if (fs.existsSync(this.filePath)) {
      // TODO - use promises
      const content = fs.readFileSync(this.filePath, {encoding: 'utf8'});
      return JSON.parse(content);
    }
    return {};
  }

  private writeFile(store: FileContents) {
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2));
  }
}

function hasLegacyLocalCredentials(store: FileContents) {
  return store.token && store.oauth2ClientSettings;
}

function hasLegacyGlobalCredentials(store: FileContents) {
  return !!store.access_token;
}
