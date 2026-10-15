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
import {
  SAMPLE_RATING_PLATES,
  extractRatingPlate,
  validateExtractedPlate,
} from '../ai/ratingPlateVision.js';
import { runFirstFixAgentWorkflow } from '../ai/firstFixAgent.js';
import {
  renderDiagnosticIntakeHtml,
  renderStockedProCarouselHtml,
  renderEmergencyShutoffHtml,
} from '../mcp/uiTemplates.js';

export interface AppOptions {
  publicBaseUrl?: string;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const baseUrl = options.publicBaseUrl || process.env.PUBLIC_BASE_URL || 'http://localhost:3001';

  // Standard CORS and body parsing
  app.use(cors());
  app.use(express.json());

  // Static assets for Alexa+ storeListing icons and Web Simulator
  const assetsDir = path.resolve(process.cwd(), 'addon-package', 'assets');
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use('/assets', express.static(assetsDir));
  app.use(express.static(publicDir));

  app.get('/simulator', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

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
  // Sprint 3: AI Multimodal Rating Plate & Agentic Orchestration Endpoints
  // --------------------------------------------------------------------------
  app.get('/api/demo/sample-plates', (_req: Request, res: Response) => {
    res.json({
      success: true,
      samplePlates: Object.values(SAMPLE_RATING_PLATES),
    });
  });

  app.post('/api/ai/extract-rating-plate', async (req: Request, res: Response) => {
    try {
      const extracted = await extractRatingPlate(req.body);
      const validation = validateExtractedPlate(extracted, req.body.userConfirmedSerial);
      res.json({
        success: true,
        extracted,
        validation,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/ai/orchestrate', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const result = await runFirstFixAgentWorkflow(req.body);
      const latency = Date.now() - startTime;
      const preventedTruckRoll =
        result.status === 'slot_reserved' || result.status === 'ready_for_booking';
      appState.recordMcpCall(latency, preventedTruckRoll);
      res.json(result);
    } catch (err) {
      console.error('[AI Orchestrator Error]', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // --------------------------------------------------------------------------
  // Sprint 4: Fleet Console, Interactive MCP Apps & Simulator Endpoints
  // --------------------------------------------------------------------------
  app.post('/api/demo/reset', (_req: Request, res: Response) => {
    appState.resetAppState();
    res.json({
      status: 'reset_complete',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/fleet/status', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      vans: appState.vans,
      appointments: Array.from(appState.appointments.values()),
      ucpSessions: Array.from(appState.ucpSessions.values()),
      ringAccessWindows: Array.from(appState.ringAccessWindows.values()),
      ringAuditLogs: appState.ringAuditLogs,
      telemetry: appState.getTelemetry(),
    });
  });

  app.get('/api/mcp-apps/:appName', (req: Request, res: Response) => {
    const appName = req.params.appName;
    const q = req.query as any;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (appName === 'diagnostic-intake.html' || appName === 'diagnostic-intake') {
      res.send(renderDiagnosticIntakeHtml(q));
    } else if (appName === 'stocked-pro-carousel.html' || appName === 'stocked-pro-carousel') {
      res.send(renderStockedProCarouselHtml(q));
    } else if (appName === 'emergency-shutoff.html' || appName === 'emergency-shutoff') {
      res.send(renderEmergencyShutoffHtml(q));
    } else {
      res.status(404).send('<h1>MCP App UI Resource Not Found</h1>');
    }
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
