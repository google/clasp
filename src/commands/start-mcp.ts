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

// This file defines the 'start-mcp-server' (alias 'mcp') command for the
// clasp CLI.

import {Command} from 'commander';

import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {AuthInfo} from '../auth/auth.js';
import {buildMcpServer} from '../mcp/server.js';

export const command = new Command('start-mcp-server')
  .alias('mcp')
  .description('Starts an MCP server for interacting with apps script.')
  .action(async function (this: Command): Promise<void> {
    const auth: AuthInfo = this.opts().auth;

    const server = buildMcpServer(auth);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  });
