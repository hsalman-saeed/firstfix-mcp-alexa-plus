# alexa-plus-ucp-mcp-kit

[![NPM Version](https://img.shields.io/npm/v/alexa-plus-ucp-mcp-kit.svg)](https://www.npmjs.com/package/alexa-plus-ucp-mcp-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-2025--11--25-green.svg)](https://modelcontextprotocol.io/)
[![Universal Commerce Protocol](https://img.shields.io/badge/UCP-2026--01--11-orange.svg)](https://ucp.dev/)
[![Tests Passing](https://img.shields.io/badge/Tests-90%2F90_Passing-34C759)](https://github.com/hsalman-saeed/firstfix-mcp-alexa-plus)

**`alexa-plus-ucp-mcp-kit`** is a lightweight, zero-dependency, open-source TypeScript SDK designed to solve the common integration friction points encountered when building **Alexa+ Add-Ons**, **MCP 2025-11-25 Streamable HTTP services**, **Interactive MCP Apps (`text/html;profile=mcp-app`)**, and **Universal Commerce Protocol (UCP 2026-01-11)** checkout pipelines.

Originally developed for **FirstFix MCP** during the **Amazon Developer Hackathon 2026**:
- **GitHub Repository**: [https://github.com/hsalman-saeed/firstfix-mcp-alexa-plus](https://github.com/hsalman-saeed/firstfix-mcp-alexa-plus)
- **Live AWS Production Deployment**: [https://qe2khmjs7zmipvuuk2ailnsq340lfhrg.lambda-url.us-east-1.on.aws/](https://qe2khmjs7zmipvuuk2ailnsq340lfhrg.lambda-url.us-east-1.on.aws/)
- **Upstream Agent Skill Contribution**: [AmazonAppDev/devices-agent-skills PR #14](https://github.com/AmazonAppDev/devices-agent-skills/pull/14)
- **NPM Package**: [https://www.npmjs.com/package/alexa-plus-ucp-mcp-kit](https://www.npmjs.com/package/alexa-plus-ucp-mcp-kit)
- **Automated Test Verification**: **90 / 90 tests passing (100% across 10 suites)**

---

## The 6 Core Exported Utilities

1. **`normalizeMcpStreamableHeaders(headers)`**: Normalizes incoming HTTP request `Accept` headers to guarantee both `application/json` and `text/event-stream` are negotiated, preventing premature `HTTP 406 Not Acceptable` rejections from strict MCP Streamable HTTP transports.
2. **`createUcpIdempotencyStore(ttlMs)`**: 24-hour RFC-compliant `Idempotency-Key` caching store featuring SHA-256 payload hashing and automatic `HTTP 409 Conflict` detection for mutated request bodies.
3. **`buildUcpEnvelope(params)`**: Generates strict, schema-compliant `dev.ucp.shopping.checkout` (`2026-01-11`) envelopes for `/checkout-sessions`, `/complete`, and `/cancel`.
4. **`createCorrelationTokenBridge(secret)`**: Creates cryptographic HMAC-SHA256 correlation tokens tying together UCP checkout sessions, Alexa+ Local Booking SPI appointment dispatches, and Ring Smart Arrival access windows.
5. **`buildMcpAppPostMessageScript(appUri)`**: Generates the client-side JSON-RPC 2.0 `window.parent.postMessage` bridge script (`ui/initialize`, `ui/message`, `ui/resize`, `ui/update-context`) for embedded MCP App iframes.
6. **`validateAddonImageDimensions(buffer, expectedWidth, expectedHeight)`**: Inspects binary PNG IHDR chunks to ensure `addon.json` icons (64x64, 72x72, 88x88, 126x126, 180x180, 241x241) and media carousels (600x900) satisfy strict store requirements.

---

## Installation

```bash
npm install alexa-plus-ucp-mcp-kit
```

---

## Quickstart & Code Patterns

### 1. Reusable UCP Idempotency Middleware

```typescript
import { createUcpIdempotencyStore } from 'alexa-plus-ucp-mcp-kit';

const idempotency = createUcpIdempotencyStore(86400000); // 24 hours TTL

app.post('/checkout-sessions', (req, res) => {
  const key = req.headers['idempotency-key'] as string | undefined;
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

// Use as Express middleware before transport.handleRequest
app.use('/mcp', (req, _res, next) => {
  normalizeMcpStreamableHeaders(req.headers);
  next();
});
```

### 3. Cryptographic Correlation Token Bridge

```typescript
import { createCorrelationTokenBridge } from 'alexa-plus-ucp-mcp-kit';

const bridge = createCorrelationTokenBridge(process.env.BRIDGE_SECRET || 'secret-key');

// Generate token during checkout session creation
const token = bridge.generateToken({
  sessionId: 'chk_9941',
  vanId: 'van_apex_04',
});

// Verify token when Ring doorbell camera reports technician arrival
const verification = bridge.verifyToken(token);
if (verification.valid) {
  // Grant monitored temporary smart lock access for arrival window
}
```

---

## License

MIT License. Open source and free for the Amazon developer community.
