import os from 'os';
import path from 'path';

import {fileURLToPath} from 'url';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import {OAuth2Client} from 'google-auth-library';
import {afterEach, beforeEach, describe, it} from 'mocha';
import mockfs from 'mock-fs';
import nock from 'nock';
import {initClaspInstance} from '../../src/core/clasp.js';

use(chaiSubset);
use(chaiAsPromised);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mockCredentials() {
  const client = new OAuth2Client();
  client.setCredentials({
    access_token: 'mock-access-token',
  });
  return client;
}

function shouldFailFunctionOperationsWhenNotSetup() {
  it('should fail to run a function', async () => {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.functions.runFunction('myFunction', [])).to.eventually.be.rejectedWith(Error);
  });
  it('should fail to run a function with string argument', async () => {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.functions.runFunction('myFunction', ['test'])).to.eventually.be.rejectedWith(Error);
  });
  it('should fail to run a function with object argument', async () => {
    const clasp = await initClaspInstance({
      credentials: mockCredentials(),
    });
    return expect(clasp.functions.runFunction('myFunction', [{a: 'test'}])).to.eventually.be.rejectedWith(Error);
  });
}

describe('Function operations', () => {
  describe('with no project, no credentials', () => {
    beforeEach(() => {
      mockfs({});
    });
    shouldFailFunctionOperationsWhenNotSetup();
    afterEach(mockfs.restore);
  });

  describe('with no project, authenticated', () => {
    beforeEach(() => {
      mockfs({});
    });
    shouldFailFunctionOperationsWhenNotSetup();
    afterEach(mockfs.restore);
  });

  describe('with project, authenticated', () => {
    beforeEach(() => {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'ignored/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        'package.json': '{}',
        '.clasp.json': mockfs.load(path.resolve(__dirname, '../fixtures/dot-clasp-no-settings.json')),
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    afterEach(mockfs.restore);

    it('should run a function', async () => {
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => {
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true;
          return true;
        })
        .reply(200, {
          done: true,
          response: {
            result: 'Hello',
          },
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const res = await clasp.functions.runFunction('myFunction', []);
      expect(res.response?.result).to.equal('Hello');
    });
    it('should run a function with string argument', async () => {
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => {
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true;
          expect(body.parameters).to.deep.equal(['test']);
          return true;
        })
        .reply(200, {
          done: true,
          response: {
            result: 'Hello',
          },
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const res = await clasp.functions.runFunction('myFunction', ['test']);
      expect(res.response?.result).to.equal('Hello');
    });

    it('should run a function with object argument', async () => {
      nock('https://script.googleapis.com')
        .post(/\/v1\/scripts\/.*:run/, body => {
          nock('https://script.googleapis.com');
          expect(body.function).to.equal('myFunction');
          expect(body.devMode).to.be.true;
          expect(body.parameters).to.deep.equal([{a: 'test'}]);
          return true;
        })
        .reply(200, {
          done: true,
          response: {
            result: 'Hello',
          },
        });
      const clasp = await initClaspInstance({
        credentials: mockCredentials(),
      });
      const res = await clasp.functions.runFunction('myFunction', [{a: 'test'}]);
      expect(res.response?.result).to.equal('Hello');
    });
  });

  describe('with invalid project, authenticated', () => {
    beforeEach(() => {
      mockfs({
        'appsscript.json': mockfs.load(path.resolve(__dirname, '../fixtures/appsscript-no-services.json')),
        'Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'ignored/Code.js': mockfs.load(path.resolve(__dirname, '../fixtures/Code.js')),
        'page.html': mockfs.load(path.resolve(__dirname, '../fixtures/page.html')),
        'package.json': '{}',
        'node_modules/test/index.js': '',
        [path.resolve(os.homedir(), '.clasprc.json')]: mockfs.load(
          path.resolve(__dirname, '../fixtures/dot-clasprc-authenticated.json'),
        ),
      });
    });
    afterEach(mockfs.restore);
    shouldFailFunctionOperationsWhenNotSetup();
  });
});
