import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createFirstFixMcpServer } from './mcpServer.js';
import { ucpRouter } from './ucpCheckout.js';
import { localBookingRouter } from './localBookingSpi.js';
import { ringRouter } from './ringAccess.js';
import { appState } from './state.js';
import {
  getOAuthAuthorizationServerMetadata,
  getOAuthProtectedResourceMetadata,
  getUcpDiscoveryProfile,
} from '../schemas/discovery.js';

export interface AppOptions {
  publicBaseUrl?: string;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const baseUrl = options.publicBaseUrl || process.env.PUBLIC_BASE_URL || 'http://localhost:3001';

  // Standard CORS and body parsing
  app.use(cors());
  app.use(express.json());

  // Static assets for Alexa+ storeListing icons
  const assetsDir = path.resolve(process.cwd(), 'addon-package', 'assets');
  app.use('/assets', express.static(assetsDir));

  // --------------------------------------------------------------------------
  // Discovery & Protocol Profiles
  // --------------------------------------------------------------------------
  app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(getOAuthAuthorizationServerMetadata(baseUrl));
  });

  app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(getOAuthProtectedResourceMetadata(baseUrl));
  });

  app.get('/.well-known/ucp', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(getUcpDiscoveryProfile(baseUrl));
  });

  // Health and Telemetry
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'firstfix-mcp-alexa-plus',
      mcpSpecVersion: '2025-11-25',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.get('/api/telemetry', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(appState.getTelemetry());
  });

  // --------------------------------------------------------------------------
  // Self-Hosted MCP 2025-11-25 Streamable HTTP Endpoint (/mcp)
  // --------------------------------------------------------------------------
  app.all('/mcp', async (req: Request, res: Response) => {
    // Ensure required Accept header per Streamable HTTP specification
    const currentAccept = req.headers['accept'] || '';
    if (!currentAccept.includes('application/json') || !currentAccept.includes('text/event-stream')) {
      req.headers['accept'] = 'application/json, text/event-stream';
    }

    try {
      const server = createFirstFixMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode per request
        enableJsonResponse: true,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[MCP Transport Error]', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: `Internal MCP Server Error: ${String(err)}`,
          },
          id: req.body?.id ?? null,
        });
      }
    }
  });

  // --------------------------------------------------------------------------
  // Sub-Routers
  // --------------------------------------------------------------------------
  app.use(ucpRouter);
  app.use(localBookingRouter);
  app.use(ringRouter);

  return app;
}
