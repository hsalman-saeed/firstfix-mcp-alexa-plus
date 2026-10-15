import { Router, Request, Response } from 'express';
import { appState, UcpCheckoutSession, UcpLineItem, UcpTotal } from './state.js';

export const ucpRouter = Router();

// Middleware: Echo Request-Id and enforce Cache-Control: no-store
ucpRouter.use((req: Request, res: Response, next) => {
  const reqId = (req.headers['request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  res.setHeader('Request-Id', reqId);
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/**
 * POST /checkout-sessions
 * Initiates an Alexa+ UCP checkout session for the diagnostic deposit
 */
ucpRouter.post('/checkout-sessions', (req: Request, res: Response) => {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  if (idempotencyKey) {
    const cached = appState.getIdempotent(idempotencyKey);
    const bodyHash = appState.hashRequestBody(req.body);

    if (cached) {
      if (cached.bodyHash !== bodyHash) {
        res.status(409).json({
          code: 'idempotency_conflict',
          content: 'Key was used with a different request body',
        });
        return;
      }
      res.status(cached.statusCode).json(cached.responseBody);
      return;
    }
  }

  const {
    appointmentId,
    correlationToken = `ff_corr_${Date.now()}`,
    diagnosticFeeUsd = 85.0,
    bindingEstimateMinUsd = 185.0,
    bindingEstimateMaxUsd = 215.0,
    fulfillment,
  } = req.body;

  const appointment = appointmentId ? appState.appointments.get(appointmentId as string) : undefined;
  const deposit = appointment ? appointment.diagnosticFeeUsd : diagnosticFeeUsd;
  const estMin = appointment ? appointment.bindingEstimateMinUsd : bindingEstimateMinUsd;
  const estMax = appointment ? appointment.bindingEstimateMaxUsd : bindingEstimateMaxUsd;
  const estBalance = Math.round((estMin + estMax) / 2) - deposit;

  const sessionId = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const hasAddress = Boolean(fulfillment?.address?.postalCode);

  const lineItems: UcpLineItem[] = [
    {
      id: 'li_diag_deposit_01',
      title: 'FirstFix Priority Diagnostic Fee & OEM Part Lock Deposit',
      description: '100% credited toward final repair labor invoice upon technician completion.',
      quantity: 1,
      unit_price: deposit,
      total_price: deposit,
      type: 'diagnostic_fee_deposit',
      credited_to_repair: true,
    },
    {
      id: 'li_est_repair_balance_01',
      title: 'Estimated Binding Repair Balance (Due Upon Work Completion)',
      description: `Binding estimate range: $${estMin.toFixed(2)} - $${estMax.toFixed(2)}. Deposit of $${deposit.toFixed(2)} deducted automatically.`,
      quantity: 1,
      unit_price: estBalance,
      total_price: estBalance,
      type: 'estimated_repair_balance',
      credited_to_repair: false,
    },
  ];

  const totals: UcpTotal[] = [
    {
      type: 'subtotal',
      amount: deposit,
      currency: 'USD',
      description: 'Diagnostic reservation fee',
    },
    {
      type: 'tax',
      amount: 0.0,
      currency: 'USD',
      description: 'State service fee tax (0.00)',
    },
    {
      type: 'deposit_due_now',
      amount: deposit,
      currency: 'USD',
      description: 'Amount charged today via Alexa+ payment handler',
    },
    {
      type: 'estimated_balance_on_completion',
      amount: estBalance,
      currency: 'USD',
      description: 'Estimated remaining balance due after first-visit fix',
    },
    {
      type: 'total',
      amount: deposit,
      currency: 'USD',
      description: 'Total immediate charge',
    },
  ];

  const session: UcpCheckoutSession = {
    id: sessionId,
    status: hasAddress ? 'ready_for_complete' : 'incomplete',
    currency: 'USD',
    correlationToken,
    appointmentId: (appointmentId as string) || `appt_${Date.now()}`,
    line_items: lineItems,
    totals,
    fulfillment: fulfillment || {
      type: 'technician_dispatch',
    },
    ucp: {
      payment_handlers: [
        'com.amazon.payments.network_token',
        'com.amazon.payments.stored_payment_method',
      ],
    },
    links: Object.assign(
      [
        { rel: 'self', href: `/checkout-sessions/${sessionId}` },
        { rel: 'complete', href: `/checkout-sessions/${sessionId}/complete` },
        { rel: 'cancel', href: `/checkout-sessions/${sessionId}/cancel` },
      ],
      {
        self: `/checkout-sessions/${sessionId}`,
        complete: `/checkout-sessions/${sessionId}/complete`,
        cancel: `/checkout-sessions/${sessionId}/cancel`,
      }
    ),
    messages: [],
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString(),
  };

  appState.ucpSessions.set(sessionId, session);

  if (idempotencyKey) {
    const bodyHash = appState.hashRequestBody(req.body);
    appState.setIdempotent(idempotencyKey, bodyHash, 201, session);
  }

  res.status(201).json(session);
});

/**
 * GET /checkout-sessions/:id
 * Retrieves current checkout session state for crash recovery
 */
ucpRouter.get('/checkout-sessions/:id', (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const session = appState.ucpSessions.get(sessionId);
  if (!session) {
    res.status(404).json({
      code: 'session_not_found',
      message: `Checkout session '${sessionId}' was not found.`,
    });
    return;
  }
  res.status(200).json(session);
});

/**
 * PUT /checkout-sessions/:id
 * Full-resource update: address validation and tax calculation
 */
ucpRouter.put('/checkout-sessions/:id', (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const session = appState.ucpSessions.get(sessionId);
  if (!session) {
    res.status(404).json({
      code: 'session_not_found',
      message: `Checkout session '${sessionId}' was not found.`,
    });
    return;
  }

  const { fulfillment, line_items } = req.body;
  const postalCode =
    fulfillment?.address?.postalCode || req.body.address?.postalCode;

  if (postalCode === '00000') {
    res.status(422).json({
      code: 'address_undeliverable',
      message: 'Postal code 00000 is outside service territory',
      session,
    });
    return;
  }

  if (fulfillment) {
    session.fulfillment = fulfillment;
  }

  if (line_items && Array.isArray(line_items)) {
    session.line_items = line_items;
  }

  session.status = 'ready_for_complete';
  session.updatedAtIso = new Date().toISOString();

  appState.ucpSessions.set(session.id, session);
  res.status(200).json(session);
});

/**
 * POST /checkout-sessions/:id/complete
 * Captures payment and confirms appointment with 24-hour Idempotency-Key support
 */
ucpRouter.post('/checkout-sessions/:id/complete', (req: Request, res: Response) => {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  if (idempotencyKey) {
    const cached = appState.getIdempotent(idempotencyKey);
    const bodyHash = appState.hashRequestBody(req.body);

    if (cached) {
      if (cached.bodyHash !== bodyHash) {
        res.status(409).json({
          code: 'idempotency_conflict',
          content: 'Key was used with a different request body',
        });
        return;
      }
      res.status(cached.statusCode).json(cached.responseBody);
      return;
    }
  }

  const sessionId = req.params.id as string;
  const session = appState.ucpSessions.get(sessionId);
  if (!session) {
    res.status(404).json({
      code: 'session_not_found',
      message: `Checkout session '${sessionId}' was not found.`,
    });
    return;
  }

  if (session.status === 'cancelled') {
    res.status(400).json({
      code: 'session_cancelled',
      message: 'Cannot complete a cancelled checkout session.',
    });
    return;
  }

  const { payment_handler } = req.body;
  const handlerType =
    payment_handler?.type || 'com.amazon.payments.network_token';

  session.payment_handler = {
    type: handlerType,
    token: payment_handler?.token || `tok_amzn_${Date.now()}`,
    status: 'CAPTURED',
  };

  session.status = 'completed';
  session.updatedAtIso = new Date().toISOString();

  // Confirm appointment
  const appt = appState.appointments.get(session.appointmentId);
  if (appt) {
    appt.status = 'CONFIRMED';
    appt.updatedAtIso = new Date().toISOString();
  }

  const responsePayload = {
    ...session,
    payment_confirmation: {
      transactionId: `txn_ucp_${Date.now()}`,
      status: 'CAPTURED',
      depositAmountUsd: session.totals.find((t) => t.type === 'deposit_due_now')?.amount || 85.0,
      creditedToInvoice: true,
      appointmentStatus: 'CONFIRMED',
    },
  };

  if (idempotencyKey) {
    const bodyHash = appState.hashRequestBody(req.body);
    appState.setIdempotent(idempotencyKey, bodyHash, 200, responsePayload);
  }

  res.status(200).json(responsePayload);
});

/**
 * POST /checkout-sessions/:id/cancel
 * Cancels session and releases held truck stock
 */
ucpRouter.post('/checkout-sessions/:id/cancel', (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const session = appState.ucpSessions.get(sessionId);
  if (!session) {
    res.status(404).json({
      code: 'session_not_found',
      message: `Checkout session '${sessionId}' was not found.`,
    });
    return;
  }

  session.status = 'cancelled';
  session.updatedAtIso = new Date().toISOString();

  const appt = appState.appointments.get(session.appointmentId);
  if (appt) {
    appt.status = 'CANCELLED';
    if (appt.partHeld) {
      appState.releasePartOnVan(appt.vanId, appt.oemPartSku);
      appt.partHeld = false;
    }
  }

  session.messages = [
    {
      code: 'session_cancelled',
      message: 'Checkout session successfully cancelled; reserved OEM part returned to truck inventory.',
      severity: 'info',
    },
  ];

  res.status(200).json({
    ...session,
    id: session.id,
    status: 'cancelled',
    currency: session.currency,
    line_items: session.line_items,
    totals: session.totals,
    ucp: session.ucp,
    links: session.links,
    messages: session.messages,
  });
});
