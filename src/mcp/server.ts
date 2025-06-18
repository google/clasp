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

/**
 * Builds and configures an MCP (Model Context Protocol) server with tools
 * for interacting with Google Apps Script projects via clasp functionalities.
 *
 * The server exposes tools such as:
 * - `push_files`: Pushes local project files to the remote Apps Script project.
 * - `pull_files`: Pulls remote Apps Script project files to the local filesystem.
 * - `create_project`: Creates a new Apps Script project.
 * - `clone_project`: Clones an existing Apps Script project to a local directory.
 * - `list_projects`: Lists Apps Script projects accessible to the authenticated user.
 *
 * Each tool is defined with a description, input schema (using Zod),
 * and an asynchronous handler that executes the corresponding clasp logic.
 *
 * @param {AuthInfo} auth - Authentication information containing the OAuth2 credentials
 *                          required by clasp to interact with Google APIs.
 * @returns {McpServer} The configured MCP server instance.
 */
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
      // Validate required input.
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

      // Initialize a Clasp instance scoped to the provided project directory.
      const clasp = await initClaspInstance({
        credentials: auth.credentials,
        configFile: projectDir, // Tells initClaspInstance to look for .clasp.json in this dir.
        rootDir: projectDir, // Fallback root if .clasp.json isn't immediately found.
      });

      try {
        // Execute the push operation.
        const files = await clasp.files.push();
        // Format the list of pushed files for the MCP response.
        const fileList: Array<TextContent> = files.map(file => ({
          type: 'text',
          text: `Updated file: ${path.resolve(file.localPath)}`,
        }));
        return {
          status: 'success', // Indicate successful execution.
          content: [
            // Human-readable output.
            {
              type: 'text',
              text: `Pushed project in ${projectDir} to remote server successfully.`,
            },
            ...fileList,
          ],
          structuredContent: {
            // Machine-readable output.
            scriptId: clasp.project.scriptId,
            projectDir: projectDir,
            files: files.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (err) {
        // Handle errors during the push operation.
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
      // Validate required input.
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

      // Initialize a Clasp instance for the specified project directory.
      const clasp = await initClaspInstance({
        credentials: auth.credentials,
        configFile: projectDir,
        rootDir: projectDir,
      });

      try {
        // Execute the pull operation.
        const files = await clasp.files.pull();
        // Format the list of pulled files for the MCP response.
        const fileList: Array<TextContent> = files.map(file => ({
          type: 'text',
          text: `Updated file: ${path.resolve(file.localPath)}`,
        }));
        return {
          content: [
            // Human-readable output.
            {
              type: 'text',
              text: `Pushed project in ${projectDir} to remote server successfully.`,
            },
            ...fileList,
          ],
          structuredContent: {
            // Machine-readable output.
            scriptId: clasp.project.scriptId,
            projectDir: projectDir,
            files: files.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (err) {
        // Handle errors during the pull operation.
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
      // Validate required input.
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

      // Ensure the project directory exists.
      await mkdir(projectDir, {recursive: true});

      // If projectName is not provided, infer it from the project directory name.
      if (!projectName) {
        projectName = getDefaultProjectName(projectDir);
      }

      // Initialize a Clasp instance. Since it's a new project,
      // .clasp.json might not exist yet, so rootDir helps locate where it would be.
      const clasp = await initClaspInstance({
        credentials: auth.credentials,
        configFile: projectDir, // Will look for .clasp.json here or create it.
        rootDir: projectDir,
      });
      // Set the content directory (where .js, .html files will go) if specified.
      clasp.withContentDir(sourceDir ?? '.'); // Defaults to projectDir if sourceDir is not given.
      try {
        // Create the new Apps Script project remotely.
        const id = await clasp.project.createScript(projectName);
        // Pull the initial files (e.g., appsscript.json, Code.js) from the new project.
        const files = await clasp.files.pull();
        // Write the .clasp.json file with the new script ID and other settings.
        await clasp.project.updateSettings();

        const fileList: Array<TextContent> = files.map(file => ({
          type: 'text',
          text: `Updated file: ${path.resolve(file.localPath)}`,
        }));
        return {
          content: [
            // Human-readable output.
            {
              type: 'text',
              text: `Created project ${id} in ${projectDir} successfully.`,
            },
            ...fileList,
          ],
          structuredContent: {
            // Machine-readable output.
            scriptId: id,
            projectDir: projectDir,
            files: files.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (err) {
        // Handle errors during project creation or initial pull.
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
      // Validate required inputs.
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

      // Ensure the local project directory exists.
      await mkdir(projectDir, {recursive: true});

      if (!scriptId) {
        // Script ID is essential for cloning.
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

      // Initialize Clasp instance for the new local project directory.
      const clasp = await initClaspInstance({
        credentials: auth.credentials,
        configFile: projectDir,
        rootDir: projectDir,
      });
      // Configure the Clasp instance with the target script ID and content directory.
      clasp.withContentDir(sourceDir ?? '.').withScriptId(scriptId);

      try {
        // Pull files from the specified remote script ID.
        const files = await clasp.files.pull();
        // Create/update the .clasp.json file with the cloned script's ID and settings.
        clasp.project.updateSettings();

        const fileList: Array<TextContent> = files.map(file => ({
          type: 'text',
          text: `Updated file: ${path.resolve(file.localPath)}`,
        }));
        return {
          content: [
            // Human-readable output.
            {
              type: 'text',
              text: `Cloned project ${scriptId} in ${projectDir} successfully.`,
            },
            ...fileList,
          ],
          structuredContent: {
            // Machine-readable output.
            scriptId: scriptId,
            projectDir: projectDir,
            files: files.map(file => path.resolve(file.localPath)),
          },
        };
      } catch (err) {
        // Handle errors during cloning.
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
      // Initialize a Clasp instance (doesn't need a specific project directory for listing).
      const clasp = await initClaspInstance({
        credentials: auth.credentials,
      });
      try {
        // Fetch the list of scripts.
        const scripts = await clasp.project.listScripts();
        // Format the script list for the MCP response.
        const scriptList: Array<TextContent> = scripts.results.map(script => ({
          type: 'text',
          text: `${script.name} (${script.id})`, // Display name and ID.
        }));
        return {
          content: [
            // Human-readable output.
            {
              type: 'text',
              text: `Found ${scripts.results.length} Apps Script projects (script ID in parentheses):`,
            },
            ...scriptList,
          ],
          structuredContent: {
            // Machine-readable output.
            scripts: scripts.results.map(script => ({
              scriptId: script.id,
              name: script.name,
            })),
          },
        };
      } catch (err) {
        // Handle errors during listing.
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
