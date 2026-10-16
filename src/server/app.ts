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

import {
  getDynamoStatus,
  persistRecordAsync,
  fetchRecentDynamoRecords,
  clearDemoRecordsInDynamoDB,
} from '../aws/dynamoPersistence.js';
import {
  oauthRouter,
  createOAuth21ValidationMiddleware,
} from './oauthServer.js';
import {
  fsmRouter,
  getFsmDispatches,
  clearFsmDispatches,
  recordFsmDispatch,
} from './fsmWebhook.js';

export interface AppOptions {
  publicBaseUrl?: string;
}

function resolveEffectiveBaseUrl(req: Request, fallback: string): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || req.get('host');
  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return fallback.replace(/\/+$/, '');
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

  app.get('/favicon.ico', (_req: Request, res: Response) => {
    res.status(204).end();
  });

  // OAuth 2.1 PKCE Authorization Server (Gap G-4)
  app.use(oauthRouter);

  // Contractor B2B Field Service Management (FSM) Webhook Feed (Gap G-8)
  app.use(fsmRouter);

  // --------------------------------------------------------------------------
  // Discovery & Protocol Profiles (Dynamic Base URL)
  // --------------------------------------------------------------------------
  app.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
    const effectiveBase = resolveEffectiveBaseUrl(req, baseUrl);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(getOAuthAuthorizationServerMetadata(effectiveBase));
  });

  app.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
    const effectiveBase = resolveEffectiveBaseUrl(req, baseUrl);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(getOAuthProtectedResourceMetadata(effectiveBase));
  });

  app.get('/.well-known/ucp', (req: Request, res: Response) => {
    const effectiveBase = resolveEffectiveBaseUrl(req, baseUrl);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(getUcpDiscoveryProfile(effectiveBase));
  });

  // Health and Telemetry
  const getHealthPayload = (req: Request) => {
    const effectiveBase = resolveEffectiveBaseUrl(req, baseUrl);
    const dynamo = getDynamoStatus();
    return {
      status: 'ok',
      service: 'firstfix-mcp-alexa-plus',
      mcpSpecVersion: '2025-11-25',
      uptimeSeconds: Math.round(process.uptime()),
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      bedrockModelId: process.env.BEDROCK_MODEL_ID || 'us.amazon.nova-pro-v1:0',
      dynamoDbTable: process.env.DYNAMODB_TABLE_NAME || 'FirstFixMcpState',
      dynamoDbStatus: dynamo.status,
      publicBaseUrl: effectiveBase,
      mcpEndpoint: `${effectiveBase}/mcp`,
      ucpDiscoveryEndpoint: `${effectiveBase}/.well-known/ucp`,
      simulatorUrl: `${effectiveBase}/`,
    };
  };

  app.get('/health', (req: Request, res: Response) => {
    res.json(getHealthPayload(req));
  });

  app.get('/api/health', (req: Request, res: Response) => {
    res.json(getHealthPayload(req));
  });

  app.get('/api/aws/architecture-status', (req: Request, res: Response) => {
    res.json(getHealthPayload(req));
  });

  // Gap G-5: Live Amazon DynamoDB (FirstFixMcpState) records inspector
  app.get('/api/aws/dynamo-records', async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const records = await fetchRecentDynamoRecords(50);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: String(err) });
    }
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

      // Auto-dispatch contractor FSM webhook when slot is reserved (Gap G-8)
      if (result.reservation) {
        recordFsmDispatch({
          contractorId: result.reservation.vanId.includes('apex') ? 'contractor_apex_04' : 'contractor_precision_01',
          companyName: result.reservation.vanId.includes('apex') ? 'Apex Home Services' : 'Precision Trade Pros',
          vanId: result.reservation.vanId,
          technicianName: result.reservation.technicianName,
          appointmentId: result.reservation.appointmentId,
          preDiagnosedOemSku: result.reservation.oemPartSku || 'BOSCH-00631200',
          serialVariantRule: result.bomResolution?.serialVariantRuleApplied || 'Factory OEM Match',
          ucpDepositPaidUsd: result.reservation.diagnosticFeeUsd,
          correlationToken: result.correlationToken || result.reservation.correlationToken,
        });
      }

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
    clearFsmDispatches();
    clearDemoRecordsInDynamoDB().catch(() => {});
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
      fsmDispatches: getFsmDispatches(),
      telemetry: appState.getTelemetry(),
      dynamoDb: getDynamoStatus(),
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

  // OAuth 2.1 Protected Resource Validation Middleware
  const oauthProtection = createOAuth21ValidationMiddleware(baseUrl);

  // --------------------------------------------------------------------------
  // Self-Hosted MCP 2025-11-25 Streamable HTTP Endpoint (/mcp)
  // --------------------------------------------------------------------------
  app.all('/mcp', oauthProtection, async (req: Request, res: Response) => {
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
  // Sub-Routers with OAuth 2.1 protection
  // --------------------------------------------------------------------------
  app.use(oauthProtection, ucpRouter);
  app.use(oauthProtection, localBookingRouter);
  app.use(oauthProtection, ringRouter);

  return app;
}
