---
name: firstfix-dispatch-skill
description: Deterministic pre-dispatch residential appliance, HVAC, and plumbing diagnostic skill for Alexa+ and agent hosts. Triggers when a homeowner reports equipment failures, error codes, strange noises, leaks, or cooling/heating loss. Resolves machine rating plate serial-variant bill-of-materials (BOM) to identify exact OEM part numbers across 15 brands (30 BOM variants), performs sub-2ms safety hazard screening, provides zero-tool 90-second DIY pre-checks, queries local contractor van inventory to eliminate second truck rolls, orchestrates UCP diagnostic fee checkout, and schedules verified Ring arrival access.
license: MIT
compatibility: Designed for Alexa+ MCP hosts, Amazon Bedrock Nova Pro runtimes, and Agent Skills engines
metadata:
  author: firstfix-mcp
  homepage: https://github.com/hsalman-saeed/firstfix-mcp-alexa-plus
  version: 1.0.0
---

# FirstFix Pre-Dispatch & Stocked-Van Booking Skill

## 1. Overview
FirstFix MCP solves the single costliest inefficiency in residential field service: the "second truck roll." Over 37% of service dispatches fail on the initial visit because the technician arrives without the correct machine-specific OEM replacement part.

FirstFix uses a 100% deterministic decision engine to:
1. Detect critical hazards in `<2ms` and lock out non-emergency workflows.
2. Resolve subtle serial-range OEM Bill-of-Materials (BOM) differences from equipment rating plates across 15 OEM brands (30 BOM variants).
3. Guide safe, tool-free 90-second homeowner pre-checks.
4. Match exclusively with local contractor vans physically stocking the exact OEM part today.
5. Secure bookings with Alexa+ Universal Commerce Protocol (UCP 2026-01-11) diagnostic deposits, B2B contractor FSM webhooks, and Ring smart arrival access.
6. Maintain live household equipment and active warranty registries (`/api/household/registry`).

---

## 2. Strict Safety Prohibitions
To protect homeowners and maintain warranty compliance, the agent MUST adhere to these strict prohibitions:
- **NEVER** instruct or advise a homeowner to open, touch, or inspect 240V high-voltage electrical panels, junction boxes, or terminal blocks.
- **NEVER** instruct a homeowner to discharge, test, or handle dual-run or start capacitors.
- **NEVER** instruct a homeowner to adjust, disassemble, or test gas burner valves, pilot assemblies, or gas supply lines.
- **NEVER** instruct a homeowner to bypass safety switches, door latches, thermal cutoffs, or pressure switches.
- If a gas odor, active carbon monoxide alert, arcing/smoke, or uncontrolled water gushing is reported, IMMEDIATELY trigger the emergency shutoff protocol and stop all diagnostic questioning.

---

## 3. Five-Step Deterministic Workflow

### Step 1: Safety Hazard Screening (<2ms Pre-Inference Guardrails)
- Scan the user's reported symptom for critical hazards: gas leaks, carbon monoxide, electrical sparks/smoke, or burst plumbing.
- If hazards are detected, return `CRITICAL_EMERGENCY`, recommend `ui://firstfix/emergency-shutoff.html`, provide immediate utility shutoff guidance, and advise evacuation.

### Step 2: Rating-Plate Multimodal Extraction & Serial-Variant BOM Matching
- Request or scan the appliance rating/data plate using Amazon Bedrock Nova Pro (`us.amazon.nova-pro-v1:0`).
- If OCR confidence is `<0.90`, pause automated dispatch and route to `ui://firstfix/diagnostic-intake.html` for human confirmation.
- Query the deterministic BOM engine across 15 OEM brands (Bosch, Rheem, Carrier, Whirlpool, GE, Trane, A.O. Smith, Samsung, LG, KitchenAid, Lennox, Maytag, Bradford White, Frigidaire, Moen):
  - Example 1 (Bosch Dishwasher):
    - `FD99000000`–`FD99999999` -> Part `BOSCH-00631200` (BLDC 3-prong pump, $42.00).
    - `FD97000000`–`FD98999999` -> Part `BOSCH-00611332` (Twist-lock bayonet pump, $46.00).
  - Example 2 (Carrier Central AC):
    - 2022+ Run -> Part `CARRIER-HC98JA045D` (45+5 uF Dual Run Capacitor, $29.00).
    - Legacy Run -> Part `CARRIER-HC98JA040D` (40+5 uF Dual Run Capacitor, $27.00).
  - Example 3 (Rheem Gas Water Heater):
    - Post-2022 Solid-State -> Part `RHEEM-SP20172` (Flammable Vapor Sensor Kit, $34.00).
    - Pre-2022 Fusible Link -> Part `RHEEM-SP20170` (Thermal Cutoff Switch & Pilot, $38.00).
- If unknown model/brand, return `PART_VERIFICATION_REQUIRED` (zero hallucination policy).
- Evaluate factory warranty coverage and persist equipment records to the household registry.

### Step 3: Zero-Tool 90-Second Homeowner Pre-Check
- If safe, provide a zero-tool physical check that could resolve the issue without a dispatch:
  - Example: For Bosch `E24`, inspect the white sump pump impeller cover in the filter well to ensure it is snapped flush.
- If the pre-check resolves the symptom, log the resolution and close the session.

### Step 4: Live Van-Stock Query & ROI Matching
- Query contractor vans operating within the homeowner's postal code.
- Filter and rank vans with `stockCount > 0` for the resolved `oemPartSku`.
- Render `ui://firstfix/stocked-pro-carousel.html` displaying verified "First-Visit Fix Guaranteed" slots and transparent pricing.
- Exclude vans that do not carry the part to prevent wasted return trips ($165 typical return roll cost).

### Step 5: UCP Diagnostic Fee Deposit, FSM Dispatch & Ring Smart Access
- Generate an opaque cryptographic HMAC-SHA256 `correlationToken` bridging payment, booking, and physical arrival.
- Initiate Alexa+ Universal Commerce Protocol (UCP 2026-01-11) checkout session with 24-hour `Idempotency-Key` caching (credited toward repair).
- Push real-time B2B job dispatches to contractor Field Service Management (FSM) systems (ServiceTitan, Housecall Pro, Jobber via `/v1/fsm/dispatches`).
- Coordinate Ring smart doorbell/lock temporary access credentials for the verified technician arrival window.

---

## 4. Required MCP Tool Sequence
1. `firstfix_evaluate_safety_and_precheck({ symptomText, applianceCategory, errorCode })`
2. `firstfix_resolve_serial_variant_bom({ brand, modelNumber, serialNumber, errorCode, installDateIso })`
3. `firstfix_match_stocked_contractor_slots({ oemPartSku, zipCode, preferredDateIso })`
4. `firstfix_create_ucp_checkout_session({ slotId, contractorId, correlationToken, depositAmountUsd })`
5. `firstfix_provision_ring_arrival_access({ bookingId, arrivalWindowStartIso, arrivalWindowEndIso })`

---

## 5. Interactive MCP Apps (`ui://` Resources)
- `ui://firstfix/diagnostic-intake.html`: Visual rating plate scanner and `<0.90` OCR human-in-the-loop confirmation card.
- `ui://firstfix/stocked-pro-carousel.html`: Stocked pro contractor van carousel with 1-tap UCP checkout trigger.
- `ui://firstfix/emergency-shutoff.html`: Red life-safety utility shutoff step-by-step card with zero-overflow bounded layout.

---

## 6. Security, Identity & Authentication
- **OAuth 2.1 PKCE**: Strict RFC 7636 `S256` code challenge exchange (`/oauth/authorize` -> `/oauth/token`) and RFC 9728 Bearer validation (`/oauth/verify`).
- **Cryptographic Correlation Tokens**: HMAC-SHA256 linking across UCP checkout, Local Booking SPI, and Ring access control.
