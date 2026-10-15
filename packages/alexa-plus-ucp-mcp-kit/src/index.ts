import crypto from 'node:crypto';

/**
 * 1. normalizeMcpStreamableHeaders
 * Fixes Friction Log #1: Alexa+ and streamable MCP HTTP clients require both
 * application/json and text/event-stream in the Accept header.
 */
export function normalizeMcpStreamableHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
    }
  }

  const accept = normalized['accept'] || '';
  if (!accept.includes('text/event-stream')) {
    normalized['accept'] = accept ? `${accept}, text/event-stream` : 'application/json, text/event-stream';
  }
  if (!normalized['accept'].includes('application/json')) {
    normalized['accept'] = `application/json, ${normalized['accept']}`;
  }

  return normalized;
}

/**
 * 2. createUcpIdempotencyStore
 * Provides a 24-hour RFC-compliant Idempotency-Key cache with SHA-256 payload
 * fingerprinting and automatic 409 Conflict rejection for mutated request bodies.
 */
export interface IdempotencyRecord {
  key: string;
  bodyHash: string;
  statusCode: number;
  responseBody: any;
  createdAt: number;
}

export function createUcpIdempotencyStore(ttlMs = 86400000) {
  const cache = new Map<string, IdempotencyRecord>();

  function hashBody(body: any): string {
    const serialized = typeof body === 'string' ? body : JSON.stringify(body || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  function get(key: string, currentBody: any): { hit: boolean; conflict: boolean; record?: IdempotencyRecord } {
    const record = cache.get(key);
    if (!record) {
      return { hit: false, conflict: false };
    }

    const now = Date.now();
    if (now - record.createdAt > ttlMs) {
      cache.delete(key);
      return { hit: false, conflict: false };
    }

    const currentHash = hashBody(currentBody);
    if (currentHash !== record.bodyHash) {
      return { hit: true, conflict: true, record };
    }

    return { hit: true, conflict: false, record };
  }

  function set(key: string, currentBody: any, statusCode: number, responseBody: any): void {
    const bodyHash = hashBody(currentBody);
    cache.set(key, {
      key,
      bodyHash,
      statusCode,
      responseBody,
      createdAt: Date.now(),
    });
  }

  function clear(): void {
    cache.clear();
  }

  return { get, set, clear, hashBody };
}

/**
 * 3. buildUcpEnvelope
 * Generates strictly compliant dev.ucp.shopping.checkout (2026-01-11) envelopes.
 */
export interface BuildUcpEnvelopeParams {
  id: string;
  status: 'incomplete' | 'ready_for_complete' | 'completed' | 'cancelled';
  currency?: string;
  correlationToken?: string;
  diagnosticFeeUsd: number;
  bindingEstimateMinUsd: number;
  bindingEstimateMaxUsd: number;
  lineItems?: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    type: string;
    credited_to_repair?: boolean;
  }>;
  paymentConfirmationId?: string;
}

export function buildUcpEnvelope(params: BuildUcpEnvelopeParams) {
  const currency = params.currency || 'USD';
  const correlationToken = params.correlationToken || `corr_${Date.now()}`;

  const defaultLineItems = [
    {
      id: 'li_diagnostic_fee',
      title: 'Multimodal Rating-Plate Diagnostic & Part Verification Fee',
      description: '100% credited toward repair labor upon job completion',
      quantity: 1,
      unit_price: params.diagnosticFeeUsd,
      total_price: params.diagnosticFeeUsd,
      type: 'diagnostic_fee_deposit',
      credited_to_repair: true,
    },
    {
      id: 'li_estimated_repair_balance',
      title: 'Estimated Repair Balance Upon Completion',
      description: `Binding estimate ($${params.bindingEstimateMinUsd.toFixed(2)} - $${params.bindingEstimateMaxUsd.toFixed(2)}) minus deposit`,
      quantity: 1,
      unit_price: Math.max(0, params.bindingEstimateMinUsd - params.diagnosticFeeUsd),
      total_price: Math.max(0, params.bindingEstimateMinUsd - params.diagnosticFeeUsd),
      type: 'estimated_repair_balance',
      credited_to_repair: false,
    },
  ];

  const line_items = params.lineItems || defaultLineItems;
  const subtotal = line_items.reduce((sum, item) => sum + item.total_price, 0);

  const totals = [
    {
      type: 'subtotal',
      amount: subtotal,
      currency,
    },
    {
      type: 'deposit_due_now',
      amount: params.diagnosticFeeUsd,
      currency,
      description: 'Charged now to dispatch stocked contractor van. 100% credited to repair.',
    },
    {
      type: 'estimated_balance_on_completion',
      amount: Math.max(0, params.bindingEstimateMinUsd - params.diagnosticFeeUsd),
      currency,
      description: 'Due upon repair completion. Diagnostic fee fully credited.',
    },
    {
      type: 'total',
      amount: subtotal,
      currency,
    },
  ];

  return {
    ucp: {
      version: '2026-01-11',
      profile: 'dev.ucp.shopping.checkout',
    },
    checkout_session: {
      id: params.id,
      status: params.status,
      currency,
      correlationToken,
      paymentConfirmationId: params.paymentConfirmationId,
      line_items,
      totals,
      payment: {
        supported_methods: ['amazon_pay', 'credit_card'],
        deposit_collected_usd: params.status === 'completed' ? params.diagnosticFeeUsd : 0.0,
      },
    },
  };
}

/**
 * 4. createCorrelationTokenBridge
 * Generates and verifies cryptographically linked correlation tokens that bind
 * UCP checkout sessions, Local Booking SPI appointments, and Ring access windows.
 */
export function createCorrelationTokenBridge(secretKey = 'firstfix-alexa-plus-bridge-secret') {
  function generateToken(params: { sessionId: string; appointmentId?: string; vanId?: string }): string {
    const timestamp = Date.now();
    const payload = `${params.sessionId}:${params.appointmentId || 'pending'}:${params.vanId || 'fleet'}:${timestamp}`;
    const signature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex').substring(0, 12);
    return `corr_${Buffer.from(payload).toString('base64url')}_${signature}`;
  }

  function verifyToken(token: string): { valid: boolean; payload?: string } {
    if (!token || !token.startsWith('corr_')) return { valid: false };
    const parts = token.slice(5).split('_');
    if (parts.length < 2) return { valid: false };

    const encodedPayload = parts.slice(0, parts.length - 1).join('_');
    const signature = parts[parts.length - 1];

    try {
      const payload = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
      const expectedSig = crypto.createHmac('sha256', secretKey).update(payload).digest('hex').substring(0, 12);
      if (signature === expectedSig) {
        return { valid: true, payload };
      }
    } catch {
      return { valid: false };
    }

    return { valid: false };
  }

  return { generateToken, verifyToken };
}

/**
 * 5. buildMcpAppPostMessageScript
 * Generates client-side JSON-RPC 2.0 window.parent.postMessage bridge script
 * for text/html;profile=mcp-app resources.
 */
export function buildMcpAppPostMessageScript(config: { appUri: string; providerId?: string }): string {
  return `
(function() {
  var appUri = ${JSON.stringify(config.appUri)};
  var providerId = ${JSON.stringify(config.providerId || 'firstfix-home-services')};

  function sendJsonRpc(method, params, id) {
    var msg = {
      jsonrpc: '2.0',
      method: method,
      params: params || {}
    };
    if (id !== undefined) msg.id = id;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  }

  // 1. Send ui/initialize handshake
  sendJsonRpc('ui/initialize', {
    appUri: appUri,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    theme: 'dark'
  });

  // 2. Expose triggerCheckout helper for 1-Tap UCP checkout
  window.triggerCheckout = function(checkoutData) {
    checkoutData = checkoutData || {};
    checkoutData.action = 'initiate_checkout';
    checkoutData.providerId = providerId;
    sendJsonRpc('ui/message', {
      role: 'user',
      content: [{ type: 'text', text: JSON.stringify(checkoutData) }]
    });
  };

  // 3. Expose callMcpTool helper
  window.callMcpTool = function(name, args, callback) {
    var reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    sendJsonRpc('tools/call', { name: name, arguments: args }, reqId);
  };

  // 4. Listen for host ui/update-context
  window.addEventListener('message', function(evt) {
    if (evt.data && evt.data.method === 'ui/update-context') {
      if (window.onHostContextUpdate) {
        window.onHostContextUpdate(evt.data.params);
      }
    }
  });
})();
`.trim();
}

/**
 * 6. validateAddonImageDimensions
 * Parses PNG IHDR header bytes to verify width and height match Alexa+ Add-On
 * manifest requirements (e.g. 512x512 icon, 1200x800 carousel).
 */
export function validateAddonImageDimensions(
  pngBuffer: Buffer,
  expectedWidth: number,
  expectedHeight: number
): { valid: boolean; actualWidth?: number; actualHeight?: number; error?: string } {
  if (!pngBuffer || pngBuffer.length < 24) {
    return { valid: false, error: 'Buffer too small to contain valid PNG header' };
  }

  // Verify PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!pngBuffer.subarray(0, 8).equals(pngSignature)) {
    return { valid: false, error: 'Invalid PNG signature' };
  }

  // IHDR chunk starts at byte 12 (4 bytes chunk length, 4 bytes chunk type 'IHDR')
  const chunkType = pngBuffer.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') {
    return { valid: false, error: `Expected IHDR chunk, found ${chunkType}` };
  }

  const actualWidth = pngBuffer.readUInt32BE(16);
  const actualHeight = pngBuffer.readUInt32BE(20);

  if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
    return {
      valid: false,
      actualWidth,
      actualHeight,
      error: `Expected ${expectedWidth}x${expectedHeight}, got ${actualWidth}x${actualHeight}`,
    };
  }

  return { valid: true, actualWidth, actualHeight };
}
