import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3001;
const app = createApp();

const server = app.listen(port, () => {
  console.log(`==================================================================`);
  console.log(` FirstFix MCP (Alexa+ Streamable HTTP) Server`);
  console.log(` Listening on: http://localhost:${port}`);
  console.log(` MCP Endpoint: http://localhost:${port}/mcp`);
  console.log(` UCP Discovery: http://localhost:${port}/.well-known/ucp`);
  console.log(` OAuth 2.1: http://localhost:${port}/.well-known/oauth-authorization-server`);
  console.log(` RFC 9728: http://localhost:${port}/.well-known/oauth-protected-resource`);
  console.log(` Telemetry: http://localhost:${port}/api/telemetry`);
  console.log(`==================================================================`);
});

export default server;
