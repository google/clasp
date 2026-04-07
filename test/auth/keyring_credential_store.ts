// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {expect} from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';
import {StoredCredential} from '../../src/auth/credential_store.js';

describe('KeyringCredentialStore', () => {
  let KeyringCredentialStore: any;
  let setPasswordStub: sinon.SinonStub;
  let getPasswordStub: sinon.SinonStub;
  let deletePasswordStub: sinon.SinonStub;
  let findCredentialsAsyncStub: sinon.SinonStub;

  const mockCreds: StoredCredential = {
    refresh_token: 'mock-refresh-token',
    access_token: 'mock-access-token',
    expiry_date: 1234567890,
  };

  beforeEach(async () => {
    setPasswordStub = sinon.stub().resolves();
    getPasswordStub = sinon.stub().resolves(JSON.stringify(mockCreds));
    deletePasswordStub = sinon.stub().resolves();
    findCredentialsAsyncStub = sinon.stub().resolves([
      {account: 'user1', password: 'pwd1'},
      {account: 'user2', password: 'pwd2'},
    ]);

    class MockAsyncEntry {
      constructor(public service: string, public user: string) {}
      setPassword = setPasswordStub;
      getPassword = getPasswordStub;
      deletePassword = deletePasswordStub;
    }

    KeyringCredentialStore = (
      await esmock('../../src/auth/keyring_credential_store.js', {
        '@napi-rs/keyring': {
          AsyncEntry: MockAsyncEntry,
          findCredentialsAsync: findCredentialsAsyncStub,
        },
      })
    ).KeyringCredentialStore;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should save credentials using setPassword', async () => {
    const store = new KeyringCredentialStore();
    await store.save('testuser', mockCreds);

    expect(setPasswordStub.calledOnce).to.be.true;
    expect(setPasswordStub.firstCall.args[0]).to.equal(JSON.stringify(mockCreds));
  });

  it('should call deletePassword if saving undefined', async () => {
    const store = new KeyringCredentialStore();
    await store.save('testuser', undefined);

    expect(deletePasswordStub.calledOnce).to.be.true;
  });

  it('should ignore NoEntry error on deletePassword when saving undefined', async () => {
    deletePasswordStub.rejects(new Error('NoEntry'));
    const store = new KeyringCredentialStore();
    await store.save('testuser', undefined);

    expect(deletePasswordStub.calledOnce).to.be.true;
  });

  it('should load credentials using getPassword', async () => {
    const store = new KeyringCredentialStore();
    const creds = await store.load('testuser');

    expect(getPasswordStub.calledOnce).to.be.true;
    expect(creds).to.deep.equal(mockCreds);
  });

  it('should return null if no credentials exist (empty string)', async () => {
    getPasswordStub.resolves('');
    const store = new KeyringCredentialStore();
    const creds = await store.load('testuser');

    expect(creds).to.be.null;
  });

  it('should return null if getting password throws an error', async () => {
    getPasswordStub.rejects(new Error('Some DBus Error'));
    const store = new KeyringCredentialStore();
    const creds = await store.load('testuser');

    expect(creds).to.be.null;
  });

  it('should delete credentials using deletePassword', async () => {
    const store = new KeyringCredentialStore();
    await store.delete('testuser');

    expect(deletePasswordStub.calledOnce).to.be.true;
  });

  it('should ignore NoEntry error when deleting credentials', async () => {
    deletePasswordStub.rejects(new Error('NoEntry'));
    const store = new KeyringCredentialStore();
    await store.delete('testuser');

    expect(deletePasswordStub.calledOnce).to.be.true;
  });

  it('should delete all credentials using findCredentialsAsync and deletePassword', async () => {
    const store = new KeyringCredentialStore();
    await store.deleteAll();

    expect(findCredentialsAsyncStub.calledOnce).to.be.true;
    expect(findCredentialsAsyncStub.firstCall.args[0]).to.equal('clasp');
    expect(deletePasswordStub.calledTwice).to.be.true;
  });
});
