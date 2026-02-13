// Copyright 2026 Google LLC
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

// This file contains tests for auth token persistence behavior.

import {expect} from 'chai';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, describe, it} from 'mocha';
import sinon from 'sinon';

import {authorize, getAuthorizedOAuth2Client} from '../../src/auth/auth.js';
import type {StoredCredential} from '../../src/auth/credential_store.js';
import {ServerlessAuthorizationCodeFlow} from '../../src/auth/serverless_auth_code_flow.js';

type StoreStub = {
  load: sinon.SinonStub;
  save: sinon.SinonStub;
  delete: sinon.SinonStub;
  deleteAll: sinon.SinonStub;
};

function createStoreStub(credentials?: StoredCredential): StoreStub {
  return {
    load: sinon.stub().resolves(credentials ?? null),
    save: sinon.stub().resolves(),
    delete: sinon.stub().resolves(),
    deleteAll: sinon.stub().resolves(),
  };
}

async function flushMicrotasks() {
  await new Promise(resolve => setImmediate(resolve));
}

describe('Auth token persistence', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('persists id_token from refresh events for loaded credentials', async function () {
    const store = createStoreStub({
      type: 'authorized_user',
      client_id: 'client-id',
      client_secret: 'client-secret',
      refresh_token: 'refresh-token',
      access_token: 'old-access-token',
      id_token: 'old-id-token',
    });

    const client = await getAuthorizedOAuth2Client(store, 'default');
    expect(client).to.not.equal(undefined);

    client!.emit('tokens', {
      access_token: 'new-access-token',
      id_token: 'new-id-token',
      expiry_date: 1234,
    });
    await flushMicrotasks();

    expect(store.save.called).to.equal(true);
    const [, persisted] = store.save.lastCall.args;
    expect(persisted.id_token).to.equal('new-id-token');
    expect(persisted.id_token).to.not.equal(persisted.access_token);
  });

  it('persists id_token from refresh events after authorize()', async function () {
    const store = createStoreStub();
    const oauth2Client = new OAuth2Client({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost',
    });
    oauth2Client.setCredentials({
      refresh_token: 'refresh-token',
      access_token: 'old-access-token',
    });

    sinon.stub(ServerlessAuthorizationCodeFlow.prototype, 'authorize').resolves(oauth2Client);

    await authorize({
      noLocalServer: true,
      oauth2Client,
      scopes: ['https://www.googleapis.com/auth/script.projects'],
      store,
      userKey: 'default',
    });

    oauth2Client.emit('tokens', {
      access_token: 'new-access-token',
      id_token: 'new-id-token',
      expiry_date: 5678,
    });
    await flushMicrotasks();

    expect(store.save.callCount).to.be.greaterThanOrEqual(2);
    const [, persisted] = store.save.lastCall.args;
    expect(persisted.id_token).to.equal('new-id-token');
    expect(persisted.id_token).to.not.equal(persisted.access_token);
  });
});
