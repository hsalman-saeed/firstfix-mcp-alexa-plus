import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { AddressInfo } from 'node:net';

import { createApp } from '../src/server/app.js';
import { appState } from '../src/server/state.js';

describe('Sprint 2: Core Backend Server, MCP Streamable HTTP & Protocols', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    appState.reset();
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // --------------------------------------------------------------------------
  // Test 1: Audit Fix A-1 - Exact IHDR Width & Height
  // --------------------------------------------------------------------------
  it('1. Audit Fix A-1: addon-package/assets/*.png have exact required IHDR pixel dimensions', () => {
    const expectedAssets = [
      { name: 'icon_64x64.png', width: 64, height: 64 },
      { name: 'icon_72x72.png', width: 72, height: 72 },
      { name: 'icon_88x88.png', width: 88, height: 88 },
      { name: 'icon_126x126.png', width: 126, height: 126 },
      { name: 'icon_180x180.png', width: 180, height: 180 },
      { name: 'icon_241x241.png', width: 241, height: 241 },
      { name: 'carousel_600x900.png', width: 600, height: 900 },
    ];

    for (const asset of expectedAssets) {
      const filePath = path.resolve(process.cwd(), 'addon-package', 'assets', asset.name);
      assert.ok(fs.existsSync(filePath), `Asset file ${asset.name} must exist on disk`);

      const buf = fs.readFileSync(filePath);
      // Bytes 0..7: PNG signature
      assert.strictEqual(buf.readUInt8(0), 137);
      assert.strictEqual(buf.toString('ascii', 1, 4), 'PNG');

      // Bytes 12..15: Chunk type 'IHDR'
      assert.strictEqual(buf.toString('ascii', 12, 16), 'IHDR');

      // Bytes 16..19: Width (big-endian uint32)
      const actualWidth = buf.readUInt32BE(16);
      // Bytes 20..23: Height (big-endian uint32)
      const actualHeight = buf.readUInt32BE(20);

      assert.strictEqual(actualWidth, asset.width, `${asset.name} width must be ${asset.width}`);
      assert.strictEqual(actualHeight, asset.height, `${asset.name} height must be ${asset.height}`);
    }
  });

  // --------------------------------------------------------------------------
  // Test 2: Protocol Discovery Profiles
  // --------------------------------------------------------------------------
  it('2. Discovery endpoints return 200 OK with valid protocol profiles', async () => {
    // OAuth 2.1
    const oauthRes = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    assert.strictEqual(oauthRes.status, 200);
    const oauthJson = (await oauthRes.json()) as any;
    assert.ok(oauthJson.code_challenge_methods_supported.includes('S256'));
    assert.ok(oauthJson.token_endpoint_auth_methods_supported.includes('none'));

    // RFC 9728
    const protRes = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    assert.strictEqual(protRes.status, 200);
    const protJson = (await protRes.json()) as any;
    assert.ok(protJson.resource.includes('/mcp'));

    // Universal Commerce Protocol
    const ucpRes = await fetch(`${baseUrl}/.well-known/ucp`);
    assert.strictEqual(ucpRes.status, 200);
    const ucpJson = (await ucpRes.json()) as any;
    assert.strictEqual(ucpJson.version, '1.0');
    assert.ok(ucpJson.supported_payment_handlers.includes('com.amazon.payments.network_token'));
  });

  // --------------------------------------------------------------------------
  // Test 3: MCP tools/list and resources/list
  // --------------------------------------------------------------------------
  it('3. POST /mcp returns all 5 tools and 2 UI resources over Streamable HTTP', async () => {
    // tools/list
    const toolsRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });
    assert.strictEqual(toolsRes.status, 200);
    const toolsJson = (await toolsRes.json()) as any;
    const toolNames = toolsJson.result?.tools?.map((t: { name: string }) => t.name);

    assert.strictEqual(toolsJson.result?.tools?.length, 5);
    assert.ok(toolNames.includes('diagnose_equipment_and_bom'));
    assert.ok(toolNames.includes('run_safety_and_diy_precheck'));
    assert.ok(toolNames.includes('get_stocked_van_availability'));
    assert.ok(toolNames.includes('reserve_part_and_slot'));
    assert.ok(toolNames.includes('sync_ring_technician_access'));

    // resources/list
    const resourcesRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/list',
        params: {},
      }),
    });
    assert.strictEqual(resourcesRes.status, 200);
    const resourcesJson = (await resourcesRes.json()) as any;
    const resourceUris = resourcesJson.result?.resources?.map((r: { uri: string }) => r.uri);

    assert.ok(resourcesJson.result?.resources?.length >= 2);
    assert.ok(resourceUris.includes('ui://firstfix/diagnostic-intake.html'));
    assert.ok(resourceUris.includes('ui://firstfix/stocked-pro-carousel.html'));
  });

  // --------------------------------------------------------------------------
  // Test 4: MCP tools/call diagnose_equipment_and_bom (<500ms)
  // --------------------------------------------------------------------------
  it('4. POST /mcp tools/call diagnose_equipment_and_bom resolves Bosch FD99 in <500ms', async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'diagnose_equipment_and_bom',
          arguments: {
            brand: 'Bosch',
            modelNumber: 'SHPM65Z55N/01',
            serialNumber: 'FD990400412',
            errorCode: 'E24',
            symptomText: 'Standing water in dishwasher bottom',
            householdId: 'household_demo_001',
          },
        },
      }),
    });
    const roundTripMs = performance.now() - t0;
    assert.strictEqual(res.status, 200);

    const json = (await res.json()) as any;
    assert.ok(json.result?.content?.[0]?.text);

    const parsed = JSON.parse(json.result.content[0].text);
    assert.strictEqual(parsed.status, 'MATCHED');
    assert.strictEqual(parsed.oemPartSku, 'BOSCH-00631200');
    assert.strictEqual(parsed.partName, 'Bosch 3-Prong BLDC Drain Pump Assembly');
    assert.strictEqual(parsed.oemPartCostUsd, 42.0);
    assert.ok(parsed.executionLatencyMs < 500, `Execution latency ${parsed.executionLatencyMs}ms must be <500ms`);
    assert.ok(roundTripMs < 500, `Total round-trip latency ${roundTripMs}ms must be <500ms`);
  });

  // --------------------------------------------------------------------------
  // Test 5: Emergency Lockout
  // --------------------------------------------------------------------------
  it('5. POST /mcp tools/call diagnose_equipment_and_bom immediately halts on gas leak hazard', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'diagnose_equipment_and_bom',
          arguments: {
            brand: 'Rheem',
            modelNumber: 'XG50T06EC36U1',
            serialNumber: 'M0423-88710',
            errorCode: '4_FLASHES',
            symptomText: 'Strong gas smell like rotten eggs near basement water heater burner',
          },
        },
      }),
    });
    assert.strictEqual(res.status, 200);

    const json = (await res.json()) as any;
    const parsed = JSON.parse(json.result.content[0].text);

    assert.strictEqual(parsed.status, 'CRITICAL_EMERGENCY');
    assert.strictEqual(parsed.emergencyBlocked, true);
    assert.strictEqual(parsed.hazardType, 'GAS_LEAK');
    assert.ok(parsed.shutoffInstructions.includes('IMMEDIATELY EVACUATE'));
  });

  // --------------------------------------------------------------------------
  // Test 6: get_stocked_van_availability Van Filtering & ROI
  // --------------------------------------------------------------------------
  it('6. POST /mcp tools/call get_stocked_van_availability filters out unstocked Van #2 and outputs correlationToken', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'get_stocked_van_availability',
          arguments: {
            oemPartSku: 'BOSCH-00631200',
            zipCode: '98101',
            preferredDateIso: '2026-10-15',
          },
        },
      }),
    });
    assert.strictEqual(res.status, 200);

    const json = (await res.json()) as any;
    const parsed = JSON.parse(json.result.content[0].text);

    assert.strictEqual(parsed.queryPartSku, 'BOSCH-00631200');
    assert.ok(parsed.correlationToken.startsWith('ff_booking_corr_'));
    assert.strictEqual(parsed.unstockedSlotsCount, 3, 'Unstocked slots (Metro Rapid Van #2 and Valley HVAC Van #7) must be counted');

    // Metro Rapid Van #2 (missing part) must be excluded
    const hasUnstockedVan = parsed.recommendedSlots.some(
      (s: { contractorId: string }) => s.contractorId === 'contractor_metro_01'
    );
    assert.strictEqual(hasUnstockedVan, false);

    // Apex Van #4 and Precision Van #1 must be included
    assert.ok(parsed.recommendedSlots.length >= 3);
    for (const slot of parsed.recommendedSlots) {
      assert.strictEqual(slot.hasExactPart, true);
      assert.strictEqual(slot.firstFixGuarantee, true);
    }

    assert.strictEqual(parsed.roiMetrics.preventedReturnTruckRollSavingsUsd, 165.0);
    assert.strictEqual(parsed.roiMetrics.daysSaved, 14);
  });

  // --------------------------------------------------------------------------
  // Test 7: UCP Checkout Lifecycle & Request-Id Echo
  // --------------------------------------------------------------------------
  it('7. UCP Checkout Endpoints complete lifecycle and echo Request-Id header', async () => {
    const requestId = 'req_test_ucp_lifecycle_001';

    // 1. Create Session
    const createRes = await fetch(`${baseUrl}/checkout-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Request-Id': requestId,
      },
      body: JSON.stringify({
        diagnosticFeeUsd: 85.0,
        bindingEstimateMinUsd: 185.0,
        bindingEstimateMaxUsd: 215.0,
        fulfillment: {
          type: 'technician_dispatch',
          address: {
            street: '1420 5th Ave',
            city: 'Seattle',
            state: 'WA',
            postalCode: '98101',
            country: 'US',
          },
        },
      }),
    });

    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.headers.get('Request-Id'), requestId);
    assert.strictEqual(createRes.headers.get('Cache-Control'), 'no-store');

    const session = (await createRes.json()) as any;
    assert.ok(session.id.startsWith('chk_'));
    assert.strictEqual(session.status, 'ready_for_complete');
    assert.strictEqual(session.currency, 'USD');

    // Verify Deposit total
    const depositTotal = session.totals.find((t: { type: string }) => t.type === 'deposit_due_now');
    assert.strictEqual(depositTotal?.amount, 85.0);

    // 2. Complete Session
    const completeRes = await fetch(`${baseUrl}/checkout-sessions/${session.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Request-Id': requestId,
      },
      body: JSON.stringify({
        payment_handler: {
          type: 'com.amazon.payments.network_token',
          token: 'tok_network_token_valid',
        },
      }),
    });

    assert.strictEqual(completeRes.status, 200);
    assert.strictEqual(completeRes.headers.get('Request-Id'), requestId);
    const completeJson = (await completeRes.json()) as any;
    assert.strictEqual(completeJson.status, 'completed');
    assert.strictEqual(completeJson.payment_confirmation.status, 'CAPTURED');
  });

  // --------------------------------------------------------------------------
  // Test 8: UCP 24-Hour Idempotency-Key Deduplication & Conflict Detection
  // --------------------------------------------------------------------------
  it('8. UCP Idempotency-Key replays exact cached response and detects 409 body conflicts', async () => {
    const idempotencyKey = 'idemp_key_unique_test_887';

    // Create session to complete
    const createRes = await fetch(`${baseUrl}/checkout-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagnosticFeeUsd: 79.0 }),
    });
    const session = (await createRes.json()) as any;

    const payloadA = {
      payment_handler: {
        type: 'com.amazon.payments.stored_payment_method',
        token: 'tok_stored_pm_001',
      },
    };

    // First call: Successful capture
    const firstCallRes = await fetch(`${baseUrl}/checkout-sessions/${session.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payloadA),
    });
    assert.strictEqual(firstCallRes.status, 200);
    const firstBody = (await firstCallRes.json()) as any;
    assert.strictEqual(firstBody.status, 'completed');

    // Second call: Same key + Same body -> Replays cached 200 OK verbatim without double-charge
    const secondCallRes = await fetch(`${baseUrl}/checkout-sessions/${session.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payloadA),
    });
    assert.strictEqual(secondCallRes.status, 200);
    const secondBody = (await secondCallRes.json()) as any;
    assert.strictEqual(secondBody.payment_confirmation.transactionId, firstBody.payment_confirmation.transactionId);

    // Third call: Same key + DIFFERENT body -> HTTP 409 Conflict
    const payloadB = {
      payment_handler: {
        type: 'com.amazon.payments.stored_payment_method',
        token: 'tok_DIFFERENT_tampered_token',
      },
    };
    const thirdCallRes = await fetch(`${baseUrl}/checkout-sessions/${session.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payloadB),
    });
    assert.strictEqual(thirdCallRes.status, 409);
    const conflictJson = (await thirdCallRes.json()) as any;
    assert.strictEqual(conflictJson.code, 'idempotency_conflict');
    assert.ok(conflictJson.content.includes('Key was used with a different request body'));
  });

  // --------------------------------------------------------------------------
  // Test 9: Local Booking SPI Routes & Idempotent Cancel
  // --------------------------------------------------------------------------
  it('9. Local Booking SPI preserves correlationToken and supports idempotent cancellation', async () => {
    const businessId = 'contractor_apex_04';
    const correlationToken = 'ff_spi_test_corr_token_99';

    // 1. GetBusiness
    const bizRes = await fetch(`${baseUrl}/v1/localbooking/businesses/${businessId}`);
    assert.strictEqual(bizRes.status, 200);
    const bizJson = (await bizRes.json()) as any;
    assert.strictEqual(bizJson.name, 'Apex Home Services');

    // 2. GetServices
    const srvRes = await fetch(`${baseUrl}/v1/localbooking/businesses/${businessId}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correlationToken }),
    });
    assert.strictEqual(srvRes.status, 200);
    const srvJson = (await srvRes.json()) as any;
    assert.strictEqual(srvJson.correlationToken, correlationToken);

    // 3. GetAvailability (RFC 3339 timestamps)
    const availRes = await fetch(
      `${baseUrl}/v1/localbooking/businesses/${businessId}/services/srv_oem_firstfix_repair/availability?correlationToken=${correlationToken}`
    );
    assert.strictEqual(availRes.status, 200);
    const availJson = (await availRes.json()) as any;
    assert.ok(availJson.availableSlots.length >= 2);
    assert.strictEqual(availJson.availableSlots[0].startTime, '2026-10-15T14:00:00Z');

    // 4. CreateAppointment
    const apptRes = await fetch(`${baseUrl}/v1/localbooking/businesses/${businessId}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot: availJson.availableSlots[0],
        correlationToken,
        oemPartSku: 'BOSCH-00631200',
      }),
    });
    assert.strictEqual(apptRes.status, 201);
    const apptJson = (await apptRes.json()) as any;
    const appointmentId = apptJson.appointmentId;
    assert.strictEqual(apptJson.status, 'CONFIRMED');
    assert.strictEqual(apptJson.correlationToken, correlationToken);

    // 5. CancelAppointment (First cancel)
    const cancel1Res = await fetch(
      `${baseUrl}/v1/localbooking/businesses/${businessId}/appointments/${appointmentId}`,
      { method: 'DELETE' }
    );
    assert.strictEqual(cancel1Res.status, 200);
    const cancel1Json = (await cancel1Res.json()) as any;
    assert.strictEqual(cancel1Json.status, 'CANCELLED');

    // 6. CancelAppointment (Second cancel: must be idempotent 200 OK)
    const cancel2Res = await fetch(
      `${baseUrl}/v1/localbooking/businesses/${businessId}/appointments/${appointmentId}`,
      { method: 'DELETE' }
    );
    assert.strictEqual(cancel2Res.status, 200);
    const cancel2Json = (await cancel2Res.json()) as any;
    assert.strictEqual(cancel2Json.status, 'CANCELLED');
    assert.ok(cancel2Json.message.includes('already cancelled'));
  });

  // --------------------------------------------------------------------------
  // Test 10: Ring Arrival Simulator & Monitored Access Control
  // --------------------------------------------------------------------------
  it('10. Ring Access Controller arms arrival window and verifies technician at camera', async () => {
    const appointmentId = 'appt_ring_verified_001';
    const correlationToken = 'ff_ring_token_valid_772';

    // 1. Arm access window
    const armRes = await fetch(`${baseUrl}/v1/ring/access-windows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId,
        correlationToken,
        technicianName: 'Marcus Vance',
        windowStartIso: '2026-10-15T14:00:00Z',
        windowEndIso: '2026-10-15T15:30:00Z',
        cameraDeviceId: 'ring_front_door_cam_01',
      }),
    });
    assert.strictEqual(armRes.status, 201);
    const armJson = (await armRes.json()) as any;
    assert.strictEqual(armJson.armed, true);
    assert.strictEqual(armJson.status, 'SCHEDULED');

    // 2. Simulate Arrival (Valid Token & On-Time arrival: 14:15)
    const validArrivalRes = await fetch(`${baseUrl}/v1/ring/simulate-arrival`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correlationToken,
        simulatedTimestampIso: '2026-10-15T14:15:00Z',
        cameraDeviceId: 'ring_front_door_cam_01',
      }),
    });
    assert.strictEqual(validArrivalRes.status, 200);
    const validJson = (await validArrivalRes.json()) as any;
    assert.strictEqual(validJson.accessGranted, true);
    assert.strictEqual(validJson.smartLockAction, 'TEMPORARY_MONITORED_UNLOCK');
    assert.strictEqual(validJson.technicianName, 'Marcus Vance');

    // 3. Simulate Arrival (Tampered/Invalid Token -> Rejected 403)
    const invalidArrivalRes = await fetch(`${baseUrl}/v1/ring/simulate-arrival`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correlationToken: 'fake_tampered_token_999',
        simulatedTimestampIso: '2026-10-15T14:15:00Z',
      }),
    });
    assert.strictEqual(invalidArrivalRes.status, 403);
    const invalidJson = (await invalidArrivalRes.json()) as any;
    assert.strictEqual(invalidJson.accessGranted, false);
    assert.strictEqual(invalidJson.reason, 'UNAUTHORIZED_OR_INVALID_CORRELATION_TOKEN');

    // 4. Verify Telemetry
    const telemetryRes = await fetch(`${baseUrl}/api/telemetry`);
    assert.strictEqual(telemetryRes.status, 200);
    const telemetryJson = (await telemetryRes.json()) as any;
    assert.ok(telemetryJson.totalMcpCalls > 0);
    assert.ok(telemetryJson.ringAccessEvents >= 2);
  });
});
