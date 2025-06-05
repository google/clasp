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
 * @fileoverview Implements the `clasp mcp` or `clasp start-mcp-server` command.
 * This command starts a Model Context Protocol (MCP) server, allowing external
 * tools or agents to interact with clasp and Apps Script projects programmatically.
 * The server communicates over standard input/output (stdio).
 * This is likely an experimental or internal-facing feature.
 */

import {Command} from 'commander';

import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {AuthInfo} from '../auth/auth.js';
import {buildMcpServer} from '../mcp/server.js';

/**
 * Command to start a Model Context Protocol (MCP) server.
 * This server allows programmatic interaction with clasp functionalities
 * over standard input/output.
 */
export const command = new Command('start-mcp-server')
  .alias('mcp') // Short alias for the command.
  .description('Starts a Model Context Protocol (MCP) server for programmatic interaction with Apps Script projects via clasp.')
  /**
   * Action handler for the `start-mcp-server` command.
   * @this Command Instance of the commander Command.
   */
  .action(async function (this: Command): Promise<void> {
    const auth: AuthInfo = this.opts().auth; // AuthInfo is pre-initialized.

    // Build the MCP server instance, injecting necessary authentication info.
    const server = buildMcpServer(auth);

    // Use StdioServerTransport for communication over stdin/stdout.
    const transport = new StdioServerTransport();

    // Connect the server to the transport and start listening for requests.
    // This will keep the process running until the transport is closed or an error occurs.
    await server.connect(transport);

    // Note: The server will run indefinitely, listening for MCP requests on stdin
    // and sending responses to stdout, until the process is terminated or the
    // input stream is closed.
  });
