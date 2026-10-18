---
name: alexa-plus-mcp-ucp-local-booking
description: Complete architecture guide and pattern reference for building Alexa+ Add-Ons using Model Context Protocol (MCP 2025-11-25 Streamable HTTP), Interactive MCP Apps (ui:// resources with text/html;profile=mcp-app), Universal Commerce Protocol (UCP 2026-01-11), and Alexa+ Local Booking SPI.
license: MIT
compatibility: '>=1.0.0'
metadata:
  author: FirstFix MCP Team (Amazon Developer Hackathon 2026)
  version: 1.0.0
  homepage: https://github.com/hsalman-saeed/firstfix-mcp-alexa-plus
  category: alexa-plus-integrations
---

# Alexa+ MCP, UCP & Local Booking Architecture Guide

This skill equips AI developer agents (Claude Code, Cursor, Google Antigravity, Kiro) with end-to-end patterns to design, implement, and deploy production-grade **Alexa+ Add-Ons**.

- **Reference Repository**: [https://github.com/hsalman-saeed/firstfix-mcp-alexa-plus](https://github.com/hsalman-saeed/firstfix-mcp-alexa-plus)
- **Official Open PR**: [AmazonAppDev/devices-agent-skills PR #14](https://github.com/AmazonAppDev/devices-agent-skills/pull/14)
- **Live AWS Production URL**: [https://qe2khmjs7zmipvuuk2ailnsq340lfhrg.lambda-url.us-east-1.on.aws/](https://qe2khmjs7zmipvuuk2ailnsq340lfhrg.lambda-url.us-east-1.on.aws/)
- **Companion Open-Source SDK**: [`alexa-plus-ucp-mcp-kit`](https://www.npmjs.com/package/alexa-plus-ucp-mcp-kit)
- **Automated Test Verification**: **90 / 90 tests passing (100% across Sprints 1–10)**

---

## 1. Core Architecture Principles

1. **Protocol Standards**:
   - **MCP Specification**: Use `2025-11-25` over Streamable HTTP (`POST /mcp`).
   - **Interactive UI**: Serve HTML resources using `mimeType: "text/html;profile=mcp-app"` over custom `ui://` schemes with bounded `#mcp-app-root` height negotiation.
   - **Commerce**: Implement Universal Commerce Protocol (UCP) version `2026-01-11` (`dev.ucp.shopping.checkout`) with strict 24-hour `Idempotency-Key` deduplication.
   - **Local Booking SPI & FSM Webhooks**: Maintain immutable HMAC-SHA256 `correlationToken` bridging across checkout, appointment dispatch, B2B contractor FSM systems (ServiceTitan / Jobber), and Ring arrival access.
   - **OAuth 2.1 PKCE**: RFC 7636 S256 code challenge exchange (`/oauth/authorize` -> `/oauth/token`) with RFC 9728 Protected Resource Metadata.

2. **The 5 Common Integration Pitfalls & How to Avoid Them**:
   - **Pitfall 1 (MCP Accept Header Mismatch)**: Some MCP proxies send `Accept: application/json`, whereas MCP streamable servers expect `text/event-stream`. Solution: Always accept and negotiate both `application/json, text/event-stream`.
   - **Pitfall 2 (Idempotency Mutation 409 Conflict)**: When an `Idempotency-Key` is replayed with an altered request payload, RFC guidelines mandate returning `409 Conflict`, NOT the cached response!
   - **Pitfall 3 (Add-On Asset Dimensions)**: Amazon's package validator rejects non-conforming PNGs in `addon.json`. Icons must strictly meet light icon specifications and hero carousels `600x900`.
   - **Pitfall 4 (MCP App postMessage Bridge & Height Flutter)**: Sandboxed MCP App iframes must use JSON-RPC 2.0 messages with `ui/initialize`, `ui/resize`, and `ui/message`. Avoid infinite height loops by wrapping templates in `#mcp-app-root` with `height: auto !important` and clamping host resize between 420px and 640px.
   - **Pitfall 5 (Unstocked Dispatch Rolls)**: Always cross-reference machine serial BOM variants against real van stock prior to booking to avoid costly second truck rolls.

---

## 2. Interactive MCP App JSON-RPC 2.0 Bridge

In any `ui://` resource with `text/html;profile=mcp-app`, include the bidirectional `postMessage` protocol:

```javascript
// 1. Handshake with Echo Show 15 host
window.parent.postMessage({
  jsonrpc: '2.0',
  method: 'ui/initialize',
  params: {
    appUri: 'ui://firstfix/stocked-pro-carousel.html',
    viewport: { width: window.innerWidth, height: window.innerHeight },
    theme: 'dark'
  }
}, '*');

// 2. Report bounded height to host
function notifyHeight() {
  const root = document.getElementById('mcp-app-root');
  const h = root ? root.offsetHeight : document.body.offsetHeight;
  window.parent.postMessage({
    jsonrpc: '2.0',
    method: 'ui/resize',
    params: { height: Math.max(420, Math.min(640, h)) }
  }, '*');
}

// 3. Trigger 1-Tap UCP Checkout in Alexa+ Host
function triggerCheckout(checkoutData) {
  window.parent.postMessage({
    jsonrpc: '2.0',
    method: 'ui/message',
    params: {
      role: 'user',
      content: [{ type: 'text', text: JSON.stringify(checkoutData) }]
    }
  }, '*');
}
```

---

## 3. UCP Checkout State Machine

Implement the strict UCP lifecycle:
1. `POST /checkout-sessions` -> Creates session (`status: "incomplete"`).
2. `PUT /checkout-sessions/:id` -> Updates slot / billing items (`status: "ready_for_complete"`).
3. `POST /checkout-sessions/:id/complete` -> Collects payment confirmation and locks inventory (`status: "completed"`).
4. `POST /checkout-sessions/:id/cancel` -> Releases held inventory and resets session (`status: "cancelled"`).

---

## 4. Cryptographic Correlation Linking

Link all 4 subsystems using a shared token:
```
[UCP Checkout Session] ===(correlationToken)===> [Local Booking SPI] ===(correlationToken)===> [B2B FSM Dispatch] ===(correlationToken)===> [Ring Smart Access]
```
This guarantees that technician arrival verification at a Ring doorbell camera matches the exact OEM part, contractor van inventory, and homeowner dispatch order.
