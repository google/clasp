import {expect} from 'chai';
import mockfs from 'mock-fs';
import nock from 'nock';
import sinon from 'sinon';
import {claspEnv} from '../src/commands/utils.js';

export function forceInteractiveMode(value: boolean) {
  claspEnv.isInteractive = value;
}

export function setupMocks() {
  nock.disableNetConnect();
  mockfs({});
  claspEnv.isBrowserPresent = false;
}

export function resetMocks() {
  mockfs.restore();
  nock.cleanAll();
  nock.enableNetConnect();
  sinon.restore();
  claspEnv.isInteractive = process.stdout.isTTY;
  claspEnv.isBrowserPresent = process.stdout.isTTY;
}

export function mockOAuthRefreshRequest() {
  nock('https://oauth2.googleapis.com').post(/token/).reply(200, {
    access_token: 'not-a-token',
    expiors_in: 3600,
  });
}

export function mockScriptDownload({scriptId = 'mock-script-id', version}: {scriptId: string; version?: number}) {
  const query = version ? {versionNumber: version} : {};
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/content`)
    .query(query)
    .reply(200, {
      scriptId,
      files: [
        {
          name: 'appsscript',
          type: 'JSON',
          source: '{ "timeZone": "America/Los_Angeles", "dependencies": {}, "exceptionLogging": "STACKDRIVER"}',
        },
        {
          name: 'Code',
          type: 'SERVER_JS',
          source: 'function helloWorld() {\n  console.log("Hello, world!");\n}',
        },
      ],
    });
}

export function mockScriptDownloadError({
  scriptId = 'mock-script-id',
  statusCode = 400,
  body = {},
}: {scriptId?: string; statusCode?: number; body?: any}) {
  nock('https://script.googleapis.com').get(`/v1/projects/${scriptId}/content`).reply(statusCode, body);
}

export function mockListScripts() {
  nock('https://www.googleapis.com')
    .get('/drive/v3/files')
    .query(true)
    .reply(200, {
      files: [
        {
          id: 'id1',
          name: 'script 1',
        },
        {
          id: 'id2',
          name: 'script 2',
        },
        {
          id: 'id3',
          name: 'script 3',
        },
      ],
    });
}

export function mockListVersions({scriptId = 'mock-script-id'}: {scriptId?: string}) {
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/versions`)
    .query(true)
    .reply(200, {
      versions: [
        {
          scriptId,
          versionNumber: 1,
          description: 'Test version 1',
          createTime: new Date().toISOString(),
        },
        {
          scriptId,
          versionNumber: 2,
          description: 'Test version 2',
          createTime: new Date().toISOString(),
        },
      ],
    });
}

export function mockCreateScript({
  scriptId = 'mock-script-id',
  title = '',
  parentId,
}: {scriptId?: string; title?: string; parentId?: string}) {
  nock('https://script.googleapis.com')
    .post(`/v1/projects`, body => {
      expect(body.title).to.equal(title);
      return true;
    })
    .reply(200, {
      scriptId,
      title,
      parentId,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      // creator
      // lastModifyUser
    });
}

export function mockCreateBoundScript({
  scriptId = 'mock-script-id',
  title = 'Bound script',
  mimeType = 'application/vnd.google-apps.spreadsheet',
  parentId = 'mock-file-id',
}: {scriptId?: string; title?: string; mimeType?: string; parentId?: string}) {
  nock('https://www.googleapis.com')
    .post('/drive/v3/files', body => {
      expect(body.name).to.equal(title);
      expect(body.mimeType).to.equal(mimeType);
      return true;
    })
    .reply(200, {
      id: parentId,
    });

  nock('https://script.googleapis.com')
    .post('/v1/projects', body => {
      expect(body.title).to.equal('test sheet');
      expect(body.parentId).to.equal(parentId);
      return true;
    })
    .reply(200, {
      scriptId: scriptId,
      parentId: parentId,
      title,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    });
}

export function mockCreateVersion({
  scriptId = 'mock-script-id',
  description = '',
  version = 1,
}: {scriptId?: string; description?: string; version?: number | undefined}) {
  nock('https://script.googleapis.com')
    .post(`/v1/projects/${scriptId}/versions`, body => {
      expect(body.description).to.equal(description);
      return true;
    })
    .reply(200, {
      scriptId,
      versionNumber: version ?? 1,
      description: description ?? 'Auto-generated description',
      createTime: new Date().toISOString(),
    });
}

export function mockCreateDeployment({
  scriptId = 'mock-script-id',
  description = '',
  version = 1,
}: {scriptId?: string; description?: string; version?: number}) {
  nock('https://script.googleapis.com')
    .post(`/v1/projects/${scriptId}/deployments`, body => {
      expect(body.description).to.equal(description);
      expect(body.versionNumber).to.equal(version);
      return true;
    })
    .reply(200, {
      deploymentId: 'mock-deployment-id',
      deploymentConfig: {
        scriptId,
        versionNumber: version,
        manifestFileName: 'appsscript',
        description,
      },
      updateTime: new Date().toISOString(),
      entryPoints: [],
    });
}

export function mockUpdateDeployment({
  scriptId = 'mock-script-id',
  deploymentId = 'mock-deployment-id',
  description = '',
  version = 1,
}: {scriptId?: string; deploymentId?: string; description?: string; version?: number}) {
  nock('https://script.googleapis.com')
    .put(`/v1/projects/${scriptId}/deployments/${deploymentId}`, body => {
      expect(body.deploymentConfig.description).to.equal(description);
      expect(body.deploymentConfig.versionNumber).to.equal(version);
      return true;
    })
    .reply(200, {
      deploymentId,
      deploymentConfig: {
        scriptId,
        versionNumber: version,
        manifestFileName: 'appsscript',
        description,
      },
      updateTime: new Date().toISOString(),
      entryPoints: [],
    });
}

export function mockDeleteDeployment({
  scriptId = 'mock-script-id',
  deploymentId = 'mock-deployment-id',
}: {scriptId?: string; deploymentId?: string}) {
  nock('https://script.googleapis.com').delete(`/v1/projects/${scriptId}/deployments/${deploymentId}`).reply(200, {});
}

export function mockListDeployments({scriptId = 'mock-script-id'}: {scriptId?: string}) {
  nock('https://script.googleapis.com')
    .get(`/v1/projects/${scriptId}/deployments`)
    .query(true)
    .reply(200, {
      deployments: [
        {
          deploymentId: 'head-deployment-id',
          deploymentConfig: {
            scriptId,
            manifestFileName: 'appsscript',
            description: 'Head deployment',
          },
        },
        {
          deploymentId: 'mock-deployment-id',
          deploymentConfig: {
            scriptId,
            versionNumber: 1,
            manifestFileName: 'appsscript',
            description: 'lorem ipsum',
          },
        },
        {
          deploymentId: 'mock-deployment-id-2',
          deploymentConfig: {
            scriptId,
            versionNumber: 2,
            manifestFileName: 'appsscript',
            description: 'lorem ipsum',
          },
        },
      ],
    });
}

export function mockDisableService({
  projectId = 'mock-project-id',
  serviceName,
}: {projectId?: string; serviceName: string}) {
  nock('https://serviceusage.googleapis.com')
    .post(`/v1/projects/${projectId}/services/${serviceName}:disable`)
    .reply(200, {});
}

export function mockEnableService({
  projectId = 'mock-project-id',
  serviceName,
}: {projectId?: string; serviceName: string}) {
  nock('https://serviceusage.googleapis.com')
    .post(`/v1/projects/${projectId}/services/${serviceName}:enable`)
    .reply(200, {});
}

export function mockListApis() {
  nock('https://www.googleapis.com')
    .get('/discovery/v1/apis')
    .query({preferred: true})
    .reply(200, {
      items: [
        {
          kind: 'discovery#directoryItem',
          id: 'docs:v1',
          name: 'docs',
          version: 'v1',
          title: 'Google Docs API',
          description: 'Reads and writes Google Docs documents.',
          discoveryRestUrl: 'https://docs.googleapis.com/$discovery/rest?version=v1',
          icons: {
            x16: 'https://www.gstatic.com/images/branding/product/1x/googleg_16dp.png',
            x32: 'https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png',
          },
          documentationLink: 'https://developers.google.com/docs/',
          preferred: true,
        },
        {
          kind: 'discovery#directoryItem',
          id: 'gmail:v1',
          name: 'gmail',
          version: 'v1',
          title: 'Gmail API',
          description: 'The Gmail API lets you view and manage Gmail mailbox data like threads, messages, and labels.',
          discoveryRestUrl: 'https://gmail.googleapis.com/$discovery/rest?version=v1',
          icons: {
            x16: 'https://www.gstatic.com/images/branding/product/1x/googleg_16dp.png',
            x32: 'https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png',
          },
          documentationLink: 'https://developers.google.com/gmail/api/',
          preferred: true,
        },
        {
          kind: 'discovery#directoryItem',
          id: 'ignored:v1',
          name: 'ignored',
          version: 'v1',
          title: 'Ignored API',
          description: 'This API should be ignored.',
          discoveryRestUrl: 'https://ignored.googleapis.com/$discovery/rest?version=v1',
          icons: {
            x16: 'https://www.gstatic.com/images/branding/product/1x/googleg_16dp.png',
            x32: 'https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png',
          },
          documentationLink: 'https://developers.google.com/ignored/api/',
          preferred: true,
        },
      ],
    });
}

export function mockListEnabledServices({projectId = 'mock-project-id'}: {projectId?: string}) {
  nock('https://serviceusage.googleapis.com')
    .get(`/v1/projects/${projectId}/services`)
    .query(true)
    .reply(200, {
      services: [
        {
          name: '123',
          state: 'ENABLED',
          config: {
            name: 'docs.googleapis.com',
          },
        },
      ],
    });
}

export function mockListLogEntries({
  projectId = 'mock-gcp-project',
  timestamp = '2023-10-27T10:00:00Z',
  entries = [
    {
      timestamp,
      logName: `projects/${projectId}/logs/stdout`,
      severity: 'INFO',
      insertId: 'test-insert-id',
      resource: {
        type: 'app_script_function',
        labels: {
          project_id: projectId,
          function_name: 'myFunction',
        },
      },
      textPayload: 'test log',
    },
  ],
}: {projectId?: string; timestamp?: string; entries?: object[]} = {}) {
  nock('https://logging.googleapis.com')
    .post(/\/v2\/entries:list/, body => {
      expect(body.resourceNames).to.eql([`projects/${projectId}`]);
      return true;
    })
    .reply(200, {
      entries,
      nextPageToken: undefined,
    });
}
