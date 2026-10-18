import { Router, Request, Response } from 'express';
import { appState, RingAccessWindow, RingArrivalLog } from './state.js';

export const ringRouter = Router();

// Middleware: Echo Request-Id and cache headers
ringRouter.use((req: Request, res: Response, next) => {
  const reqId = (req.headers['request-id'] as string) || `req_ring_${Date.now()}`;
  res.setHeader('Request-Id', reqId);
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/**
 * POST /v1/ring/access-windows
 * Arms a verified technician arrival window
 */
ringRouter.post('/v1/ring/access-windows', (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({
      code: 'invalid_payload',
      message: 'Request body must be a valid JSON object.',
    });
    return;
  }

  const {
    appointmentId,
    correlationToken,
    technicianName = 'Marcus Vance',
    vanId = 'van_apex_04',
    windowStartIso,
    windowEndIso,
    cameraDeviceId = 'ring_front_door_cam_01',
  } = req.body;

  if (!appointmentId || !correlationToken) {
    res.status(400).json({
      code: 'missing_parameters',
      message: 'Both appointmentId and correlationToken are required to arm a Ring access window.',
    });
    return;
  }

  const nowMs = Date.now();
  const startIso = windowStartIso || new Date(nowMs - 15 * 60 * 1000).toISOString();
  const endIso = windowEndIso || new Date(nowMs + 2 * 3600 * 1000).toISOString();

  const windowId = `ring_win_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const window: RingAccessWindow = {
    windowId,
    appointmentId,
    correlationToken,
    technicianName,
    vanId,
    cameraDeviceId,
    windowStartIso: startIso,
    windowEndIso: endIso,
    armed: true,
    securityPolicy: 'MONITORED_SINGLE_ENTRY',
    status: 'SCHEDULED',
    createdAtIso: new Date().toISOString(),
  };

  appState.ringAccessWindows.set(windowId, window);

  res.status(201).json({
    windowId,
    appointmentId,
    correlationToken,
    status: 'SCHEDULED',
    armed: true,
    technicianName,
    windowStart: startIso,
    windowEnd: endIso,
    cameraDeviceId,
    securityPolicy: 'MONITORED_SINGLE_ENTRY',
  });
});

/**
 * POST /v1/ring/simulate-arrival
 * Simulates a Ring doorbell event & verifies correlation token for monitored entry
 */
ringRouter.post('/v1/ring/simulate-arrival', (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({
      code: 'invalid_payload',
      message: 'Request body must be a valid JSON object.',
    });
    return;
  }

  if (!req.body.correlationToken && !req.body.windowId) {
    res.status(400).json({
      code: 'missing_parameters',
      message: 'Either correlationToken or windowId must be provided for arrival simulation.',
    });
    return;
  }

  const {
    correlationToken,
    windowId,
    cameraDeviceId = 'ring_front_door_cam_01',
    simulatedTimestampIso = new Date().toISOString(),
  } = req.body;

  appState.ringAccessEvents++;
  const eventId = `ring_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Find matching access window
  let matchedWindow: RingAccessWindow | undefined;
  if (windowId && appState.ringAccessWindows.has(windowId)) {
    const candidate = appState.ringAccessWindows.get(windowId);
    if (candidate && (!correlationToken || candidate.correlationToken === correlationToken)) {
      matchedWindow = candidate;
    }
  }
  if (!matchedWindow && correlationToken) {
    matchedWindow = Array.from(appState.ringAccessWindows.values()).find(
      (w) => w.correlationToken === correlationToken && w.armed
    );
  }
  if (!matchedWindow && windowId) {
    matchedWindow = appState.ringAccessWindows.get(windowId);
  }

  // 1. Token / Window Not Found
  if (!matchedWindow || (correlationToken && matchedWindow.correlationToken !== correlationToken)) {
    const log: RingArrivalLog = {
      eventId,
      windowId: windowId || 'unknown',
      appointmentId: 'unknown',
      correlationToken: correlationToken || 'none',
      technicianName: 'Unknown Visitor',
      cameraDeviceId,
      eventTimeIso: simulatedTimestampIso,
      accessGranted: false,
      reason: 'UNAUTHORIZED_OR_INVALID_CORRELATION_TOKEN',
    };
    appState.ringAuditLogs.push(log);

    res.status(403).json({
      eventId,
      accessGranted: false,
      reason: 'UNAUTHORIZED_OR_INVALID_CORRELATION_TOKEN',
      message: 'Technician correlation token does not match any armed arrival window.',
    });
    return;
  }

  // 2. Window Expiration Check
  const simTime = new Date(simulatedTimestampIso).getTime();
  const startTime = new Date(matchedWindow.windowStartIso).getTime();
  const endTime = new Date(matchedWindow.windowEndIso).getTime();

  if (simTime > endTime) {
    matchedWindow.status = 'EXPIRED';
    const log: RingArrivalLog = {
      eventId,
      windowId: matchedWindow.windowId,
      appointmentId: matchedWindow.appointmentId,
      correlationToken: matchedWindow.correlationToken,
      technicianName: matchedWindow.technicianName,
      cameraDeviceId,
      eventTimeIso: simulatedTimestampIso,
      accessGranted: false,
      reason: 'ARRIVAL_WINDOW_EXPIRED',
    };
    appState.ringAuditLogs.push(log);

    res.status(403).json({
      eventId,
      accessGranted: false,
      reason: 'ARRIVAL_WINDOW_EXPIRED',
      message: `Technician arrived after scheduled arrival window expired at ${matchedWindow.windowEndIso}.`,
    });
    return;
  }

  if (simTime < startTime - 30 * 60 * 1000) {
    // Arrived >30 mins before window start
    const log: RingArrivalLog = {
      eventId,
      windowId: matchedWindow.windowId,
      appointmentId: matchedWindow.appointmentId,
      correlationToken: matchedWindow.correlationToken,
      technicianName: matchedWindow.technicianName,
      cameraDeviceId,
      eventTimeIso: simulatedTimestampIso,
      accessGranted: false,
      reason: 'ARRIVAL_WINDOW_NOT_YET_ACTIVE',
    };
    appState.ringAuditLogs.push(log);

    res.status(403).json({
      eventId,
      accessGranted: false,
      reason: 'ARRIVAL_WINDOW_NOT_YET_ACTIVE',
      message: `Technician arrived before window opens at ${matchedWindow.windowStartIso}.`,
    });
    return;
  }

  // 3. Valid arrival -> Grant monitored temporary unlock
  matchedWindow.status = 'ARRIVED';
  const log: RingArrivalLog = {
    eventId,
    windowId: matchedWindow.windowId,
    appointmentId: matchedWindow.appointmentId,
    correlationToken: matchedWindow.correlationToken,
    technicianName: matchedWindow.technicianName,
    cameraDeviceId,
    eventTimeIso: simulatedTimestampIso,
    accessGranted: true,
    reason: 'VERIFIED_TECHNICIAN_CORRELATION_MATCH',
  };
  appState.ringAuditLogs.push(log);

  res.status(200).json({
    eventId,
    windowId: matchedWindow.windowId,
    appointmentId: matchedWindow.appointmentId,
    accessGranted: true,
    technicianName: matchedWindow.technicianName,
    smartLockAction: 'TEMPORARY_MONITORED_UNLOCK',
    cameraLiveStreamUrl: `https://ring.example.com/live/${cameraDeviceId}`,
    reason: 'VERIFIED_TECHNICIAN_CORRELATION_MATCH',
    message: `Verified technician ${matchedWindow.technicianName} arrived at ${cameraDeviceId}. Monitored single-entry access granted.`,
  });
});

/**
 * GET /v1/ring/audit-logs
 * Retrieves immutable arrival audit logs
 */
ringRouter.get('/v1/ring/audit-logs', (_req: Request, res: Response) => {
  res.status(200).json({
    totalEvents: appState.ringAuditLogs.length,
    events: appState.ringAuditLogs,
  });
});
