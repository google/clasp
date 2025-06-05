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

/**
 * @fileoverview Builds and configures a Model Context Protocol (MCP) server
 * that exposes core `clasp` functionalities as tools. This allows programmatic
 * interaction with `clasp` operations such as pushing, pulling, creating,
 * cloning, and listing Apps Script projects.
 */

import path from 'path';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {TextContent} from '@modelcontextprotocol/sdk/types.js';
import {mkdir} from 'fs/promises';
import {z} from 'zod';
import {AuthInfo} from '../auth/auth.js';
import {getDefaultProjectName} from '../commands/create-script.js';
import {getVersion} from '../commands/program.js';
import {initClaspInstance} from '../core/clasp.js';

/**
 * Builds and configures an MCP server with tools for interacting with `clasp`.
 * @param auth Authenticated `AuthInfo` object for authorizing `clasp` operations.
 * @returns The configured `McpServer` instance.
 */
export function buildMcpServer(auth: AuthInfo): McpServer {
  const server = new McpServer({
    name: 'Clasp', // Name of the MCP server.
    version: getVersion(), // Version of clasp, used for MCP server versioning.
  });

  // Tool to push local files to the Apps Script project.
  server.tool(
    'push_files',
    'Uploads all local Apps Script project files from a specified directory to the remote Google Apps Script server, overwriting existing remote files.',
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
      // Validate input: projectDir is required.
      if (!projectDir) {
        return {
          isError: true,
          content: [{type: 'text', text: 'Error: Project directory is required for push_files tool.'}],
        };
      }

      try {
        // Initialize a Clasp instance scoped to the provided project directory.
        const clasp = await initClaspInstance({
          credentials: auth.credentials,
          configFile: projectDir, // Tells clasp where to find .clasp.json
          rootDir: projectDir,    // Sets the base for file operations if contentDir is relative
        });

        // Perform the push operation.
        const pushedFiles = await clasp.files.push();
        const fileListMessage: TextContent[] = pushedFiles.map(file => ({
          type: 'text',
          text: `  - Pushed: ${path.relative(projectDir, file.localPath) || path.basename(file.localPath)}`,
        }));

        return {
          status: 'success',
          content: [
            {
              type: 'text',
              text: `Successfully pushed ${pushedFiles.length} file(s) from "${projectDir}" to script ID "${clasp.project.scriptId}".`,
            },
            ...fileListMessage,
          ],
          structuredContent: {
            scriptId: clasp.project.scriptId,
            projectDirectory: path.resolve(projectDir), // Absolute path
            pushedFiles: pushedFiles.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (error) {
        // Handle errors during the push operation.
        return {
          isError: true,
          content: [{type: 'text', text: `Error pushing project files from "${projectDir}": ${error.message}`}],
        };
      }
    },
  );

  // Tool to pull files from the Apps Script project to the local filesystem.
  server.tool(
    'pull_files',
    'Downloads all files from the remote Google Apps Script project to a specified local directory, overwriting local files if they exist.',
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
      // Validate input: projectDir is required.
      if (!projectDir) {
        return {
          isError: true,
          content: [{type: 'text', text: 'Error: Project directory is required for pull_files tool.'}],
        };
      }

      try {
        // Initialize a Clasp instance for the specified project directory.
        const clasp = await initClaspInstance({
          credentials: auth.credentials,
          configFile: projectDir,
          rootDir: projectDir,
        });

        // Perform the pull operation.
        const pulledFiles = await clasp.files.pull();
        const fileListMessage: TextContent[] = pulledFiles.map(file => ({
          type: 'text',
          text: `  - Pulled: ${path.relative(projectDir, file.localPath) || path.basename(file.localPath)}`,
        }));

        return {
          status: 'success',
          content: [
            {
              type: 'text',
              text: `Successfully pulled ${pulledFiles.length} file(s) for script ID "${clasp.project.scriptId}" into "${projectDir}".`,
            },
            ...fileListMessage,
          ],
          structuredContent: {
            scriptId: clasp.project.scriptId,
            projectDirectory: path.resolve(projectDir),
            pulledFiles: pulledFiles.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (error) {
        // Handle errors during the pull operation.
        return {
          isError: true,
          content: [{type: 'text', text: `Error pulling project files into "${projectDir}": ${error.message}`}],
        };
      }
    },
  );

  // Tool to create a new Apps Script project.
  server.tool(
    'create_project',
    'Creates a new standalone Google Apps Script project and initializes it in a specified local directory.',
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
    async ({projectDir, sourceDir, projectName: inputProjectName}) => {
      // Validate input: projectDir is required.
      if (!projectDir) {
        return {
          isError: true,
          content: [{type: 'text', text: 'Error: Project directory is required for create_project tool.'}],
        };
      }

      try {
        // Ensure the target local project directory exists.
        await mkdir(projectDir, {recursive: true});

        // Determine project name: use provided, or infer from directory name.
        const projectName = inputProjectName || getDefaultProjectName(projectDir);

        // Initialize Clasp for the new project directory.
        // `initClaspInstance` will create a default .clasp.json structure if one doesn't exist.
        const clasp = await initClaspInstance({
          credentials: auth.credentials,
          configFile: path.join(projectDir, '.clasp.json'), // Specify path for potential new .clasp.json
          rootDir: projectDir,
        });

        // Set content directory if specified, otherwise it defaults to rootDir.
        if (sourceDir) {
          clasp.withContentDir(sourceDir);
        }

        // Create the new Apps Script project on the server.
        const newScriptId = await clasp.project.createScript(projectName);
        // Pull the default files created by Apps Script (e.g., Code.gs, appsscript.json).
        const pulledFiles = await clasp.files.pull();
        // Save the new scriptId and other settings to .clasp.json.
        await clasp.project.updateSettings();

        const fileListMessage: TextContent[] = pulledFiles.map(file => ({
          type: 'text',
          text: `  - Created local file: ${path.relative(projectDir, file.localPath) || path.basename(file.localPath)}`,
        }));

        return {
          status: 'success',
          content: [
            {
              type: 'text',
              text: `Successfully created new Apps Script project "${projectName}" (ID: ${newScriptId}) in "${projectDir}".`,
            },
            ...fileListMessage,
          ],
          structuredContent: {
            scriptId: newScriptId,
            projectDirectory: path.resolve(projectDir),
            sourceDirectory: sourceDir ? path.resolve(projectDir, sourceDir) : path.resolve(projectDir),
            createdFiles: pulledFiles.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{type: 'text', text: `Error creating project in "${projectDir}": ${error.message}`}],
        };
      }
    },
  );

  // Tool to clone an existing Apps Script project to a local directory.
  server.tool(
    'clone_project',
    'Clones an existing Google Apps Script project (by its Script ID) to a specified local directory.',
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
    async ({projectDir, sourceDir, scriptId: scriptIdToClone}) => {
      // Validate inputs.
      if (!projectDir) {
        return {isError: true, content: [{type: 'text', text: 'Error: Project directory is required for clone_project tool.'}]};
      }
      if (!scriptIdToClone) {
        return {isError: true, content: [{type: 'text', text: 'Error: Script ID is required to clone a project.'}]};
      }

      try {
        // Ensure the target local project directory exists.
        await mkdir(projectDir, {recursive: true});

        // Initialize Clasp for the new project directory, associating it with the scriptId to clone.
        const clasp = await initClaspInstance({
          credentials: auth.credentials,
          configFile: path.join(projectDir, '.clasp.json'), // Define where .clasp.json will be created
          rootDir: projectDir,
        });
        clasp.withContentDir(sourceDir ?? '.'); // Set source directory, defaults to projectDir.
        clasp.withScriptId(scriptIdToClone);   // Associate with the remote script.

        // Pull files from the remote project.
        const pulledFiles = await clasp.files.pull();
        // Save the project settings (scriptId, rootDir) to .clasp.json.
        await clasp.project.updateSettings();

        const fileListMessage: TextContent[] = pulledFiles.map(file => ({
          type: 'text',
          text: `  - Cloned file: ${path.relative(projectDir, file.localPath) || path.basename(file.localPath)}`,
        }));

        return {
          status: 'success',
          content: [
            {
              type: 'text',
              text: `Successfully cloned project ID "${scriptIdToClone}" into "${projectDir}".`,
            },
            ...fileListMessage,
          ],
          structuredContent: {
            scriptId: scriptIdToClone,
            projectDirectory: path.resolve(projectDir),
            sourceDirectory: sourceDir ? path.resolve(projectDir, sourceDir) : path.resolve(projectDir),
            clonedFiles: pulledFiles.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{type: 'text', text: `Error cloning project ID "${scriptIdToClone}" into "${projectDir}": ${error.message}`}],
        };
      }
    },
  );

  // Tool to list Apps Script projects accessible to the authenticated user.
  server.tool(
    'list_projects',
    'Lists all Google Apps Script projects accessible to the authenticated user.',
    {},
    {
      title: 'List Apps Script projects',
      openWorldHint: false,
      destructiveHint: true,
      idempotentHint: false,
      readOnlyHint: false,
    },
    async () => {
      try {
        // Initialize a Clasp instance (doesn't need to be project-specific for listing).
        const clasp = await initClaspInstance({
          credentials: auth.credentials,
        });

        // Fetch the list of scripts.
        const scriptListResponse = await clasp.project.listScripts();
        const scripts = scriptListResponse.results;

        const scriptListMessages: TextContent[] = scripts.map(script => ({
          type: 'text',
          text: `  - ${script.name} (ID: ${script.id})`,
        }));

        return {
          status: 'success',
          content: [
            {
              type: 'text',
              text: `Found ${scripts.length} Apps Script project(s):`,
            },
            ...scriptListMessages,
          ],
          structuredContent: {
            projects: scripts.map(script => ({
              scriptId: script.id,
              name: script.name,
            })),
            partialResults: scriptListResponse.partialResults,
          },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{type: 'text', text: `Error listing projects: ${error.message}`}],
        };
      }
    },
  );

  return server;
}
