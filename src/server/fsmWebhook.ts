import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { persistRecordAsync } from '../aws/dynamoPersistence.js';

export type FsmPlatform = 'ServiceTitan_v2' | 'HousecallPro' | 'Jobber';

export interface FsmWebhookDispatchEvent {
  eventId: string;
  targetFsmPlatform: FsmPlatform;
  contractorId: string;
  companyName: string;
  vanId: string;
  technicianName: string;
  appointmentId: string;
  preDiagnosedOemSku: string;
  serialVariantRule: string;
  ucpDepositPaidUsd: number;
  ringTemporaryAccessWindowId?: string;
  correlationToken: string;
  deliveryStatus: 'DELIVERED_200_OK';
  dispatchedAtIso: string;
  fsmJobId: string;
}

const fsmDispatchLogs: FsmWebhookDispatchEvent[] = [];

export function recordFsmDispatch(
  data: Omit<FsmWebhookDispatchEvent, 'eventId' | 'deliveryStatus' | 'dispatchedAtIso' | 'fsmJobId' | 'targetFsmPlatform'> & {
    targetFsmPlatform?: FsmPlatform;
  }
): FsmWebhookDispatchEvent {
  const eventId = `fsm_evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const targetFsmPlatform = data.targetFsmPlatform || 'ServiceTitan_v2';
  const prefix =
    targetFsmPlatform === 'ServiceTitan_v2'
      ? 'ST_JOB'
      : targetFsmPlatform === 'HousecallPro'
        ? 'HCP_JOB'
        : 'JOB_';

  const fsmJobId = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const nowIso = new Date().toISOString();

  const event: FsmWebhookDispatchEvent = {
    ...data,
    eventId,
    targetFsmPlatform,
    deliveryStatus: 'DELIVERED_200_OK',
    dispatchedAtIso: nowIso,
    fsmJobId,
  };

  fsmDispatchLogs.unshift(event);
  if (fsmDispatchLogs.length > 50) {
    fsmDispatchLogs.pop();
  }

  // Persist to DynamoDB asynchronously
  persistRecordAsync(`FSM_WEBHOOK#${data.contractorId}`, eventId, event);

  return event;
}

export function getFsmDispatches(): FsmWebhookDispatchEvent[] {
  return fsmDispatchLogs;
}

export function clearFsmDispatches(): void {
  fsmDispatchLogs.length = 0;
}

export const fsmRouter = Router();

/**
 * GET /v1/fsm/dispatches
 * Returns all recorded FSM webhook dispatches
 */
fsmRouter.get('/v1/fsm/dispatches', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    totalDispatches: fsmDispatchLogs.length,
    supportedPlatforms: ['ServiceTitan_v2', 'HousecallPro', 'Jobber'],
    dispatches: fsmDispatchLogs,
  });
});

/**
 * POST /v1/fsm/webhook-test
 * Simulates manual B2B contractor FSM dispatch trigger
 */
fsmRouter.post('/v1/fsm/webhook-test', (req: Request, res: Response) => {
  const {
    targetFsmPlatform = 'ServiceTitan_v2',
    contractorId = 'contractor_apex_04',
    companyName = 'Apex Home Services',
    vanId = 'van_apex_04',
    technicianName = 'Marcus Vance',
    appointmentId = `appt_test_${Date.now()}`,
    preDiagnosedOemSku = 'BOSCH-00631200',
    serialVariantRule = 'Manufacture date 2019+ (Batch FD99+)',
    ucpDepositPaidUsd = 85.0,
    ringTemporaryAccessWindowId = `ring_win_${Date.now()}`,
    correlationToken = `ff_corr_test_${Date.now()}`,
  } = req.body || {};

  const event = recordFsmDispatch({
    targetFsmPlatform,
    contractorId,
    companyName,
    vanId,
    technicianName,
    appointmentId,
    preDiagnosedOemSku,
    serialVariantRule,
    ucpDepositPaidUsd,
    ringTemporaryAccessWindowId,
    correlationToken,
  });

  res.status(201).json({
    success: true,
    message: `Dispatched B2B FSM Webhook to ${targetFsmPlatform} with pre-staged OEM inventory`,
    event,
  });
});
