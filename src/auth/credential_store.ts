import {Credentials, JWTInput} from 'google-auth-library';

export type StoredCredential = JWTInput & Credentials;

export interface CredentialStore {
  save(user: string, credentials: StoredCredential): Promise<void>;
  delete(user: string): Promise<void>;
  deleteAll(): Promise<void>;
  load(user: string): Promise<StoredCredential | null>;
}
