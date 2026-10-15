---
name: firstfix-dispatch-skill
description: Deterministic pre-dispatch residential appliance, HVAC, and plumbing diagnostic skill for Alexa+ and agent hosts. Triggers when a homeowner reports equipment failures, error codes, strange noises, leaks, or cooling/heating loss. Resolves machine rating plate serial-variant bill-of-materials (BOM) to identify exact OEM part numbers, performs instant safety hazard screening, provides zero-tool 90-second DIY pre-checks, queries local contractor van inventory to eliminate second truck rolls, orchestrates UCP diagnostic fee checkout, and schedules verified Ring arrival access.
license: MIT
compatibility: Designed for Alexa+ MCP hosts, AWS Strands Agents, and Kiro Crew
metadata:
  author: firstfix-mcp
  version: 1.0.0
---

# FirstFix Pre-Dispatch & Stocked-Van Booking Skill

## 1. Overview
FirstFix MCP solves the single costliest inefficiency in residential field service: the "second truck roll." Over 37% of service dispatches fail on the initial visit because the technician arrives without the correct machine-specific OEM replacement part.

FirstFix uses a 100% deterministic decision engine to:
1. Detect critical hazards and lock out non-emergency workflows.
2. Resolve subtle serial-range OEM Bill-of-Materials (BOM) differences from equipment rating plates.
3. Guide safe, tool-free 90-second homeowner pre-checks.
4. Match exclusively with local contractor vans physically stocking the exact OEM part today.
5. Secure bookings with Alexa+ Universal Commerce Protocol (UCP) diagnostic deposits and Ring arrival access.

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

### Step 1: Safety Hazard Screening
- Scan the user's reported symptom for critical hazards: gas leaks, carbon monoxide, electrical sparks/smoke, or burst plumbing.
- If hazards are detected, return `CRITICAL_EMERGENCY`, provide immediate utility shutoff guidance, and advise evacuation.

### Step 2: Rating-Plate Multimodal Extraction & Serial-Variant BOM Matching
- Request or scan the appliance rating/data plate.
- Extract `brand`, `modelNumber`, `serialNumber`, and active error code.
- Query the deterministic BOM engine. For example:
  - Bosch dishwasher `SHPM65Z55N/01` with `E24`:
    - Serial prefix `FD99000000`–`FD99999999` -> Part `BOSCH-00631200` (BLDC 3-prong pump).
    - Serial prefix `FD97000000`–`FD98999999` -> Part `BOSCH-00611332` (Twist-lock pump).
- Evaluate factory warranty coverage based on serial manufacture date or registered installation date.

### Step 3: Zero-Tool 90-Second Homeowner Pre-Check
- If safe, provide a zero-tool physical check that could resolve the issue without a dispatch:
  - Example: For Bosch `E24`, inspect the white sump pump impeller cover in the filter well to ensure it is snapped flush.
- If the pre-check resolves the symptom, log the resolution and close the session.

### Step 4: Live Van-Stock Query & ROI Matching
- Query contractor vans operating within the homeowner's postal code.
- Filter and rank vans with `stockCount > 0` for the resolved `oemPartSku`.
- Present verified "First-Visit Fix Guaranteed" slots along with transparent, binding diagnostic fee pricing.
- Exclude vans that do not carry the part to prevent wasted return trips ($165 typical return roll cost).

### Step 5: UCP Diagnostic Fee Deposit & Ring Smart Access
- Generate an opaque `correlationToken` for Alexa+ local booking.
- Initiate Alexa+ Universal Commerce Protocol (UCP) checkout session for the diagnostic fee (credited toward repair).
- Coordinate Ring smart doorbell/lock temporary access pin for the scheduled arrival window.

---

## 4. Required MCP Tool Sequence
1. `firstfix_evaluate_safety_and_precheck({ symptomText, applianceCategory, errorCode })`
2. `firstfix_resolve_serial_variant_bom({ brand, modelNumber, serialNumber, errorCode, installDateIso })`
3. `firstfix_match_stocked_contractor_slots({ oemPartSku, zipCode, preferredDateIso })`
4. `firstfix_create_ucp_checkout_session({ slotId, contractorId, correlationToken, depositAmountUsd })`
5. `firstfix_provision_ring_arrival_access({ bookingId, arrivalWindowStartIso, arrivalWindowEndIso })`
