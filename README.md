# FirstFix MCP (Alexa+)

**FirstFix MCP** is a B2B2C multimodal pre-dispatch diagnostic, serial-variant OEM part matcher, and stocked-van booking engine built for the **Build, Ship, Shape: Amazon Developer Hackathon 2026** (Primary Track: **Alexa+**, Secondary Dual-Track: **Ring**, Mini Challenges: **AWS Builder** and **Open Source**).

FirstFix eliminates the single costliest friction in home services: the **"second truck roll"** (where a technician arrives, diagnoses the issue, discovers they lack the exact OEM replacement part, and charges the customer for a return visit 7–14 days later).

---

## Sprint 1 & Sprint 2 Deliverables Overview

### Sprint 1: Monorepo Foundation & Protocol Discovery
1. **Official Protocol & Discovery Manifests**:
   - `addon-package/addon.json`: Official Alexa+ MCP QuickStart schema with strict character length limits, 6 light icon sizes, and HTTPS endpoint definition.
   - `skills/firstfix-dispatch-skill/SKILL.md`: Valid YAML frontmatter meeting the open `agentskills.io` standard with 5-step deterministic workflow and strict safety prohibitions.
   - `.well-known/oauth-authorization-server.json`: OAuth 2.1 authorization server metadata with `S256` PKCE.
   - `.well-known/oauth-protected-resource.json`: Protected resource metadata per RFC 9728.
   - `.well-known/ucp.json`: Universal Commerce Protocol profile with Amazon payments handlers.

2. **100% Deterministic Domain Engine & Seed Data**:
   - `src/data/seedData.ts`: 15 realistic residential OEM BOM rules (including Bosch dishwasher BLDC vs twist-lock disambiguation, Rheem FV sensor, Carrier run capacitor), safety shutoffs, 4 contractor van inventories, and household registry.
   - `src/engine/firstFixEngine.ts`: Pure TypeScript domain engine functions for safety hazard filtering, serial-variant BOM resolution, and stocked-van matching.
   - `src/storage/storageAdapter.ts`: Local JSON & DynamoDB dual storage adapter with simulated multi-session state updates.

### Sprint 2: Core Backend Server, MCP Streamable HTTP & Protocols
1. **Audit Fix A-1 (True-Dimension PNG Generator)**:
   - `src/scripts/generateValidAssets.ts`: Binary-level PNG chunk generator writing exact required dimensions (`64x64`, `72x72`, `88x88`, `126x126`, `180x180`, `241x241`, `600x900`) with CRC32 checksums into `addon-package/assets/`.

2. **MCP Specification 2025-11-25 over Streamable HTTP (`POST /mcp`)**:
   - `src/server/mcpServer.ts`: MCP server factory using `@modelcontextprotocol/sdk` and `@modelcontextprotocol/ext-apps/server`.
   - Exposes 2 MCP App UI Resources: `ui://firstfix/diagnostic-intake.html` and `ui://firstfix/stocked-pro-carousel.html`.
   - Exposes 5 MCP Tools: `diagnose_equipment_and_bom`, `run_safety_and_diy_precheck`, `get_stocked_van_availability`, `reserve_part_and_slot`, and `sync_ring_technician_access`.
   - All tool calls execute in `<500ms` and record `executionLatencyMs`.

3. **Alexa+ Universal Commerce Protocol (UCP) Checkout Endpoints**:
   - `src/server/ucpCheckout.ts`: Full UCP lifecycle (`POST /checkout-sessions`, `GET /checkout-sessions/:id`, `PUT /checkout-sessions/:id`, `POST /checkout-sessions/:id/complete`, `POST /checkout-sessions/:id/cancel`).
   - 24-hour `Idempotency-Key` deduplication, body hash conflict detection (`HTTP 409 Conflict`), and `Request-Id` echoing.

4. **Alexa+ Local Booking SPI (`com.amazon.alexa.localbooking.v1`)**:
   - `src/server/localBookingSpi.ts`: REST routes for `GetBusiness`, `GetServices`, `GetAvailability` (RFC 3339 timestamps), `CreateAppointment`, and idempotent `CancelAppointment`.

5. **Ring Track Verified Technician Arrival & Temporary Access Control API**:
   - `src/server/ringAccess.ts`: Access window arming (`/v1/ring/access-windows`) and doorbell arrival simulation (`/v1/ring/simulate-arrival`) with camera token matching and monitored unlock authorization.

---

## Quick Start

### 1. Prerequisites
- Node.js v18+ (tested on v24.15.0)
- npm v9+ (tested on v11.12.1)

### 2. Installation
```bash
npm install
```

### 3. Generate Valid True-Dimension PNG Assets
```bash
npx tsx src/scripts/generateValidAssets.ts
```

### 4. Typecheck
```bash
npm run typecheck
```

### 5. Run Test Suite (Sprint 1 + Sprint 2)
```bash
npm test
```

### 6. Start the Server Locally
```bash
npm start
# Server listens on http://localhost:3001
```

---

## License
MIT License (see [LICENSE](LICENSE)).