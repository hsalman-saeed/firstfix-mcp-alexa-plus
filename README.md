# FirstFix MCP (Alexa+)

**FirstFix MCP** is a B2B2C multimodal pre-dispatch diagnostic, serial-variant OEM part matcher, and stocked-van booking engine built for the **Build, Ship, Shape: Amazon Developer Hackathon 2026** (Primary Track: **Alexa+**, Secondary Dual-Track: **Ring**, Mini Challenges: **AWS Builder** and **Open Source**).

FirstFix eliminates the single costliest friction in home services: the **"second truck roll"** (where a technician arrives, diagnoses the issue, discovers they lack the exact OEM replacement part, and charges the customer for a return visit 7–14 days later).

---

## Sprint 1 Deliverables Overview

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

3. **Automated Unit Testing & Verification**:
   - `tests/sprint1.test.ts`: 10 comprehensive unit tests using Node's built-in test runner and `tsx`.
   - 100% test pass rate with zero external network or mock dependencies.

---

## Quick Start

### 1. Prerequisites
- Node.js v18+ (tested on v24.15.0)
- npm v9+ (tested on v11.12.1)

### 2. Installation
```bash
npm install
```

### 3. Typecheck
```bash
npm run typecheck
```

### 4. Run Test Suite
```bash
npm test
```

### 5. Build
```bash
npm run build
```

---

## License
MIT License (see [LICENSE](LICENSE)).