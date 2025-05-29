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
