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

// This file builds and configures a Model Context Protocol (MCP) server
// that exposes clasp functionalities (like push, pull, create, clone, list)
// as remotely callable tools for programmatic interaction.

import path from 'path';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {TextContent} from '@modelcontextprotocol/sdk/types.js';
import {mkdir} from 'fs/promises';
import {z} from 'zod';
import {AuthInfo} from '../auth/auth.js';
import {getDefaultProjectName} from '../commands/create-script.js';
import {getVersion} from '../commands/program.js';
import {initClaspInstance} from '../core/clasp.js';

export function buildMcpServer(auth: AuthInfo) {
  const server = new McpServer({
    name: 'Clasp',
    version: getVersion(),
  });

  server.tool(
    'push_files',
    'Pushes the local Apps Script project to the remote server.',
    {
      projectDir: z
        .string()
        .describe(
          'The local directory of the Apps Script project to push. Must contain a .clasp.json file containing the project info.',
        ),
    },
    {
      title: 'Push project files to Apps Script',
      openWorldHint: false,
      destructiveHint: true,
      idempotentHint: false,
      readOnlyHint: false,
    },
    async ({projectDir}) => {
      if (!projectDir) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Project directory is required.',
            },
          ],
        };
      }

      const clasp = await initClaspInstance({
        credentials: auth.credentials,
        configFile: projectDir,
        rootDir: projectDir,
      });

      try {
        const files = await clasp.files.push();
        const fileList: Array<TextContent> = files.map(file => ({
          type: 'text',
          text: `Updated file: ${path.resolve(file.localPath)}`,
        }));
        return {
          status: 'success',
          content: [
            {
              type: 'text',
              text: `Pushed project in ${projectDir} to remote server successfully.`,
            },
            ...fileList,
          ],
          structuredContent: {
            scriptId: clasp.project.scriptId,
            projectDir: projectDir,
            files: files.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error pushing project: ${err.message}`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    'pull_files',
    'Pulls files from Apps Script project to local file system.',
    {
      projectDir: z
        .string()
        .describe(
          'The local directory of the Apps Script project to update. Must contain a .clasp.json file containing the project info.',
        ),
    },
    {
      title: 'Pull project files from Apps Script',
      openWorldHint: false,
      destructiveHint: true,
      idempotentHint: false,
      readOnlyHint: false,
    },
    async ({projectDir}) => {
      if (!projectDir) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Project directory is required.',
            },
          ],
        };
      }

      const clasp = await initClaspInstance({
        credentials: auth.credentials,
        configFile: projectDir,
        rootDir: projectDir,
      });

      try {
        const files = await clasp.files.pull();
        const fileList: Array<TextContent> = files.map(file => ({
          type: 'text',
          text: `Updated file: ${path.resolve(file.localPath)}`,
        }));
        return {
          content: [
            {
              type: 'text',
              text: `Pushed project in ${projectDir} to remote server successfully.`,
            },
            ...fileList,
          ],
          structuredContent: {
            scriptId: clasp.project.scriptId,
            projectDir: projectDir,
            files: files.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error pushing project: ${err.message}`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    'create_project',
    'Create a new apps script project.',
    {
      projectDir: z.string().describe('The local directory where the Apps Script project will be created.'),
      sourceDir: z
        .string()
        .optional()
        .describe(
          'Local directory relative to projectDir where the Apps Script source files are located. If not specified, files are placed in the project directory.',
        ),
      projectName: z
        .string()
        .optional()
        .describe('Name of the project. If not provided, the project name will be infered from the directory.'),
    },
    {
      title: 'Create Apps Script project',
      openWorldHint: false,
      destructiveHint: true,
      idempotentHint: false,
      readOnlyHint: false,
    },
    async ({projectDir, sourceDir, projectName}) => {
      if (!projectDir) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Project directory is required.',
            },
          ],
        };
      }

      await mkdir(projectDir, {recursive: true});

      if (!projectName) {
        projectName = getDefaultProjectName(projectDir);
      }

      const clasp = await initClaspInstance({
        credentials: auth.credentials,
        configFile: projectDir,
        rootDir: projectDir,
      });
      clasp.withContentDir(sourceDir ?? '.');
      try {
        const id = await clasp.project.createScript(projectName);
        const files = await clasp.files.pull();
        await clasp.project.updateSettings();
        const fileList: Array<TextContent> = files.map(file => ({
          type: 'text',
          text: `Updated file: ${path.resolve(file.localPath)}`,
        }));
        return {
          content: [
            {
              type: 'text',
              text: `Created project ${id} in ${projectDir} successfully.`,
            },
            ...fileList,
          ],
          structuredContent: {
            scriptId: id,
            projectDir: projectDir,
            files: files.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error pushing project: ${err.message}`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    'clone_project',
    'Clones and pulls an existing Apps Script project to a local directory.',
    {
      projectDir: z.string().describe('The local directory where the Apps Script project will be created.'),
      sourceDir: z
        .string()
        .optional()
        .describe(
          'Local directory relative to projectDir where the Apps Script source files are located. If not specified, files are placed in the project directory.',
        ),
      scriptId: z.string().optional().describe('ID of the Apps Script project to clone.'),
    },
    {
      title: 'Create Apps Script project',
      openWorldHint: false,
      destructiveHint: true,
      idempotentHint: false,
      readOnlyHint: false,
    },
    async ({projectDir, sourceDir, scriptId}) => {
      if (!projectDir) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Project directory is required.',
            },
          ],
        };
      }

      await mkdir(projectDir, {recursive: true});

      if (!scriptId) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Script ID is required.',
            },
          ],
        };
      }

      const clasp = await initClaspInstance({
        credentials: auth.credentials,
        configFile: projectDir,
        rootDir: projectDir,
      });
      clasp.withContentDir(sourceDir ?? '.').withScriptId(scriptId);

      try {
        const files = await clasp.files.pull();
        clasp.project.updateSettings();
        const fileList: Array<TextContent> = files.map(file => ({
          type: 'text',
          text: `Updated file: ${path.resolve(file.localPath)}`,
        }));
        return {
          content: [
            {
              type: 'text',
              text: `Cloned project ${scriptId} in ${projectDir} successfully.`,
            },
            ...fileList,
          ],
          structuredContent: {
            scriptId: scriptId,
            projectDir: projectDir,
            files: files.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error pushing project: ${err.message}`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    'list_projects',
    'List Apps Script projects',
    {},
    {
      title: 'List Apps Script projects',
      openWorldHint: false,
      destructiveHint: true,
      idempotentHint: false,
      readOnlyHint: false,
    },
    async () => {
      const clasp = await initClaspInstance({
        credentials: auth.credentials,
      });
      try {
        const scripts = await clasp.project.listScripts();
        const scriptList: Array<TextContent> = scripts.results.map(script => ({
          type: 'text',
          text: `${script.name} (${script.id})`,
        }));
        return {
          content: [
            {
              type: 'text',
              text: `Found ${scripts.results.length} Apps Script projects (script ID in parentheses):`,
            },
            ...scriptList,
          ],
          structuredContent: {
            scripts: scripts.results.map(script => ({
              scriptId: script.id,
              name: script.name,
            })),
          },
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error listing projects: ${err.message}`,
            },
          ],
        };
      }
    },
  );

  return server;
}
