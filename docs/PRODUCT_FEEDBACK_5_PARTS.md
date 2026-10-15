# FIRSTFIX MCP — 5-PART COMPREHENSIVE PRODUCT FEEDBACK FOR AMAZON ENGINEERING TEAMS
**Hackathon:** Build, Ship, Shape: Amazon Developer Hackathon 2026  
**Project:** FirstFix MCP (`firstfix-mcp-alexa-plus`)  
**Live Production URL:** `https://qe2khmjs7zmipvuuk2ailnsq340lfhrg.lambda-url.us-east-1.on.aws`  
**Authors:** FirstFix MCP Core Engineering Team

---

## PART 1: ALEXA+ ADD-ONS (`addon.json`) & MCP SERVER INTEGRATION (`2025-11-25`)

### 1. What Worked Brilliantly
- **Standardized Model Context Protocol Adoption:** Adopting the open Model Context Protocol (MCP `2025-11-25`) is a massive leap forward for the Alexa ecosystem. Replacing legacy intent schemas, slots, and dialog models with standardized JSON-RPC `tools/list` and `tools/call` allowed our team to develop, test, and debug tool logic locally in minutes using standard TypeScript unit tests before connecting to Alexa+.
- **Streamable HTTP Transport:** Support for Server-Sent Events (SSE) alongside HTTP POST enables responsive voice streaming, giving Alexa+ users conversational feedback as calculations unfold.

### 2. Specific Pain Points & Gaps
- **Strict Header Validation in Client SDKs:** The official `@modelcontextprotocol/sdk` rejects stateless JSON requests with `HTTP 406 Not Acceptable` if the client does not send both `application/json` and `text/event-stream` in the `Accept` header. Many standard HTTP clients and health monitors only send `Accept: application/json`.
- **Manifest Dimension Validation Ambiguity:** In `addon.json`, icon requirements (`64x64`, `72x72`, `88x88`, `126x126`, `180x180`, `241x241`) and carousel dimensions (`600x900`) are strictly enforced at package validation time, but error messages on upload do not clearly pinpoint which image failed or what pixel dimensions were detected.

### 3. Actionable Feature Requests
1. **Official Express & Fastify Middleware:** Provide an officially maintained `@amazon/alexa-plus-mcp-express` adapter that automatically handles `express.json()` stream drainage and header normalization.
2. **Local Add-On CLI Validator:** Release an `alexa-plus addon validate` CLI command in npm that checks `addon.json`, verifies icon PNG IHDR headers, and tests the target MCP endpoint prior to store submission.

---

## PART 2: ALEXA+ MCP APPS (`text/html;profile=mcp-app`) & ECHO SHOW MULTIMODAL UX

### 1. What Worked Brilliantly
- **Embedded Web Standards on Echo Show 15:** Returning interactive web experiences directly from MCP resources (`resources/read` with `mimeType: text/html;profile=mcp-app`) provides complete design freedom. We were able to build high-density visual telemetry—including interactive BOM diagrams, real-time contractor van maps, and Ring doorbell video verification cards—that look stunning on the 1080p Echo Show 15 display.
- **Client-to-Host PostMessage Bridge:** The `window.parent.postMessage` bridge with `ui/initialize` and `ui/message` allowed clean separation of presentation logic from server-side tool execution.

### 2. Specific Pain Points & Gaps
- **Unidirectional Documentation:** Documentation extensively covers how the iframe sends messages to the host (`ui/message` with `initiate_checkout`), but lacks standard protocols for host-to-iframe updates (such as pushing confirmed order receipts or updated van inventories back into the visual card).
- **Theme and Viewport Metadata:** While `ui/initialize` passes viewport dimensions, there is no reactive resize event when the Echo Show 15 splits between widget view and full-screen view.

### 3. Actionable Feature Requests
1. **Standardized Host-to-Iframe Push Events:** Specify `ui/update-context` and `ui/state-change` in the core MCP App specification so all Alexa+ hosts can push reactive context updates without iframe reloads.
2. **Offline Asset Caching for Echo Show Displays:** Allow MCP Apps to bundle static CSS and icons locally or leverage Service Workers so cards render instantly even in poor WiFi conditions.

---

## PART 3: UNIVERSAL COMMERCE PROTOCOL (UCP `2026-01-11`) & IDEMPOTENCY

### 1. What Worked Brilliantly
- **Transparent Deposit Collection:** UCP's hypermedia checkout model (`dev.ucp.shopping.checkout`) allowed us to implement an upfront $85 diagnostic deposit that is 100% credited toward the repair balance. Homeowners see exactly what they are paying upfront vs. due upon completion.
- **Strict 24-Hour Idempotency:** The mandatory `Idempotency-Key` header with SHA-256 payload verification completely eliminates double-charging risks on network retries or accidental voice repetitions.

### 2. Specific Pain Points & Gaps
- **Lack of TypeScript Types / JSON Schema Package:** Developers must manually recreate UCP response types from documentation examples. Missing a single required key in the envelope (`ucp`, `line_items`, `totals`, `links`, `messages`) leads to opaque validation errors.
- **State Transition Schema Inconsistency:** `/checkout-sessions/:id/complete` and `/cancel` require the entire top-level checkout envelope to be re-emitted rather than a concise transition payload.

### 3. Actionable Feature Requests
1. **Publish `@amazon/ucp-sdk` on npm:** Provide official TypeScript definitions and validation schemas for UCP checkout, order, and refund lifecycle endpoints.
2. **Native Sandbox Mock Server:** Provide an Amazon-hosted UCP sandbox emulator that developers can test against locally with pre-seeded test credit cards and error simulations.

---

## PART 4: ALEXA+ LOCAL BOOKING SPI & B2B2C SERVICE DISPATCH

### 1. What Worked Brilliantly
- **Real-Time Appointment Scheduling:** The Local Booking SPI (`com.amazon.alexa.booking.local.v1`) provides clean REST semantics for querying contractor time slots and reserving 2-hour arrival windows.
- **Flexible Metadata Passthrough:** We were able to inject technician profiles, vehicle IDs, and stocking guarantees directly into the appointment confirmation cards.

### 2. Specific Pain Points & Gaps
- **Missing Stock-Aware Dispatch Semantic:** The standard Local Booking SPI assumes all technicians are identical and only compares calendar availability. In trade services (HVAC, plumbing, appliance repair), booking an available tech who does not have the required OEM part on their van guarantees a failed first visit.
- **Disconnected Identity Between Booking and Commerce:** Booking SPI uses appointment IDs while UCP uses session IDs, requiring developers to write custom cryptographic bridge tokens to correlate payments with appointments.

### 3. Actionable Feature Requests
1. **First-Class Inventory / Skill Filter in Booking SPI:** Add optional `requiredPartSkus` or `technicianCertifications` query parameters to `GET /v1/localbooking/slots` so the scheduling API natively filters out unstocked vans.
2. **Unified `amazonCorrelationToken`:** Support an optional correlation header passed automatically from voice session to UCP and Local Booking SPI.

---

## PART 5: AMAZON BEDROCK NOVA PRO & RING SMART ACCESS INTEGRATION

### 1. What Worked Brilliantly
- **Multimodal OCR Precision:** Amazon Bedrock Nova Pro (`us.amazon.nova-pro-v1:0` in `us-east-1`) demonstrated exceptional accuracy at reading metal-stamped appliance rating plates, correctly resolving complex serial batches (e.g. Bosch `FD991001234` vs `FD981001234`) even under challenging kitchen lighting.
- **Ring Smart Arrival Security:** Integrating Ring Smart Access with technician dispatch gives homeowners peace of mind by generating 2-hour temporary arrival passes linked to verified contractor dispatch records.

### 2. Specific Pain Points & Gaps
- **Bedrock Vision Cold-Start Latency:** Multimodal vision inference took 2.8s–4.5s, which exceeds Alexa's <500ms voice SLA. We had to architect an asynchronous pre-inference perception layer to keep voice interactions instant.
- **Non-Deterministic JSON Output Formats:** Despite explicit prompt instructions, Nova Pro occasionally emitted pluralized keys (`errorCodes`) or European label aliases (`eNr`, `fdNumber`).

### 3. Actionable Feature Requests
1. **Structured Outputs / JSON Schema Mode for Nova Pro:** Introduce native JSON Schema constrained decoding for Amazon Nova models (similar to OpenAI JSON Mode or Bedrock Tool Calling schemas) to guarantee 100% deterministic key names.
2. **Pre-Warmed Vision Instances for Alexa Skills:** Provide a low-latency multimodal preview mode in Bedrock optimized for real-time mobile and smart-display camera frames.
