import { createServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { matchplyBase, requireMatchplyToken } from './client.js';
import { matchplyToolDefinitions, runMatchplyTool } from './tools.js';

function buildServer(token: string) {
  const server = new Server({ name: 'matchply', version: '1.0.0' }, { capabilities: { tools: {} } });
  const options = { token, baseUrl: matchplyBase() };
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: matchplyToolDefinitions() }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => runMatchplyTool(request.params.name, request.params.arguments, options));
  return server;
}

async function listenHttp(server: Server) {
  const port = Number(process.env.MATCHPLY_MCP_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('MATCHPLY_MCP_PORT no es válido.');
    process.exit(1);
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  const httpServer = createServer(async (req, res) => {
    try {
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'internal', message: 'No se pudo completar la operación.' } }));
      }
    }
  });
  httpServer.listen(port, '127.0.0.1');
}

async function main() {
  const token = requireMatchplyToken();
  if (!token.ok) {
    console.error(token.message);
    process.exit(1);
  }
  const server = buildServer(token.token);
  if (process.env.MATCHPLY_MCP_TRANSPORT === 'http') {
    await listenHttp(server);
    return;
  }
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'No se pudo arrancar el servidor MCP.';
  console.error(message.includes('mp_live_') ? 'No se pudo arrancar el servidor MCP.' : message);
  process.exit(1);
});
