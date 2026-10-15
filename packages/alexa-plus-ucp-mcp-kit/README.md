# alexa-plus-ucp-mcp-kit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-2025--11--25-green.svg)](https://modelcontextprotocol.io/)
[![Universal Commerce Protocol](https://img.shields.io/badge/UCP-2026--01--11-orange.svg)](https://ucp.dev/)

**alexa-plus-ucp-mcp-kit** is a lightweight, zero-dependency, open-source TypeScript SDK designed to solve the common integration challenges encountered when building **Alexa+ Add-Ons**, **MCP 2025-11-25 Streamable HTTP services**, **Interactive MCP Apps (`text/html;profile=mcp-app`)**, and **Universal Commerce Protocol (UCP)** checkout pipelines.

Developed during the **Amazon Developer Hackathon 2026** as part of **FirstFix MCP** (Winner candidate for the Alexa+, Ring, and AWS Builder tracks).

---

## Features

- **MCP Streamable HTTP Normalizer**: Automatically ensures `Accept: application/json, text/event-stream` is negotiated, preventing 406 Not Acceptable errors in stateless JSON MCP proxies.
- **24-Hour UCP Idempotency Engine**: RFC-compliant `Idempotency-Key` store featuring SHA-256 payload hashing and automatic `409 Conflict` detection for mutated request bodies.
- **Strict UCP Envelope Builder**: Creates schema-compliant `dev.ucp.shopping.checkout` (`2026-01-11`) envelopes for `/checkout-sessions`, `/complete`, and `/cancel`.
- **Cryptographic Correlation Token Bridge**: HMAC-SHA256 correlation tokens tying together UCP checkouts, Alexa+ Local Booking SPI appointments, and Ring Smart Arrival access windows.
- **MCP App `postMessage` Bridge Generator**: Client-side JSON-RPC 2.0 bridge supporting `ui/initialize`, `tools/call`, `ui/message` (1-tap Amazon Pay checkout triggers), and `ui/update-context`.
- **PNG Dimension Validator**: Inspects binary PNG IHDR chunks to ensure `addon.json` icons (512x512) and media carousels (1200x800) pass validation before submission.

---

## Installation

```bash
npm install alexa-plus-ucp-mcp-kit
```

---

## Quickstart

### 1. Reusable UCP Idempotency Middleware

```typescript
import { createUcpIdempotencyStore } from 'alexa-plus-ucp-mcp-kit';

const idempotency = createUcpIdempotencyStore(86400000); // 24 hours TTL

app.post('/checkout-sessions', (req, res) => {
  const key = req.headers['idempotency-key'];
  if (key) {
    const check = idempotency.get(key, req.body);
    if (check.hit) {
      if (check.conflict) {
        return res.status(409).json({ error: 'Idempotency-Key payload mutated' });
      }
      return res.status(check.record.statusCode).json(check.record.responseBody);
    }
  }

  // Process checkout...
  const responseData = { id: 'chk_123', status: 'incomplete' };
  if (key) {
    idempotency.set(key, req.body, 201, responseData);
  }
  return res.status(201).json(responseData);
});
```

### 2. Streamable MCP Headers Normalizer

```typescript
import { normalizeMcpStreamableHeaders } from 'alexa-plus-ucp-mcp-kit';

const normalized = normalizeMcpStreamableHeaders(req.headers);
// Ensures accept includes both 'application/json' and 'text/event-stream'
```

### 3. Cryptographic Correlation Token Bridge

```typescript
import { createCorrelationTokenBridge } from 'alexa-plus-ucp-mcp-kit';

const bridge = createCorrelationTokenBridge(process.env.BRIDGE_SECRET);

// Generate token during checkout
const token = bridge.generateToken({
  sessionId: 'chk_9941',
  vanId: 'van_apex_04',
});

// Verify token at Ring doorbell camera arrival
const verification = bridge.verifyToken(token);
if (verification.valid) {
  // Grant monitored temporary smart lock access
}
```

---

## License

MIT License. Open source and free for the community.
