import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';

import { createApp } from '../src/server/app.js';
import { appState, resetAppState } from '../src/server/state.js';
import { normalizeBedrockParsedJson } from '../src/ai/ratingPlateVision.js';

describe('Sprint 4: Interactive Alexa+ MCP Apps (ui://), Dual-Screen Simulator & Fleet Command Center', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    resetAppState();
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
  // Test 1: Audit Fix A-4 - Live Bedrock JSON Key Normalization
  // --------------------------------------------------------------------------
  it('1. Audit Fix A-4: normalizeBedrockParsedJson normalizes plural errorCodes, model aliases, and serial aliases', () => {
    // Case A: Plural string errorCodes
    const rawPluralString = {
      brand: 'Bosch',
      model: 'SHPM65Z55N/01',
      serial: 'FD990400412',
      errorCodes: 'E24',
      confidence: 0.98,
    };
    const normA = normalizeBedrockParsedJson(rawPluralString);
    assert.strictEqual(normA.errorCode, 'E24');
    assert.strictEqual(normA.modelNumber, 'SHPM65Z55N/01');
    assert.strictEqual(normA.serialNumber, 'FD990400412');
    assert.strictEqual(normA.ocrConfidence, 0.98);

    // Case B: Plural array errorCodes
    const rawPluralArray = {
      manufacturer: 'Bosch',
      eNr: 'SHPM65Z55N/01',
      fdNumber: 'FD980112233',
      errorCodes: ['E24', 'E25'],
      ocrConfidence: 0.85,
    };
    const normB = normalizeBedrockParsedJson(rawPluralArray);
    assert.strictEqual(normB.errorCode, 'E24');
    assert.strictEqual(normB.brand, 'Bosch');
    assert.strictEqual(normB.modelNumber, 'SHPM65Z55N/01');
    assert.strictEqual(normB.serialNumber, 'FD980112233');
    assert.strictEqual(normB.ocrConfidence, 0.85);

    // Case C: Explicit override takes precedence
    const normC = normalizeBedrockParsedJson({ errorCodes: 'E22' }, 'E24');
    assert.strictEqual(normC.errorCode, 'E24');
  });

  // --------------------------------------------------------------------------
  // Test 2: MCP resources/list returns all 3 ui:// MCP App resources
  // --------------------------------------------------------------------------
  it('2. MCP resources/list returns all 3 official ui:// MCP App resources with text/html;profile=mcp-app', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-s4-res-list',
        method: 'resources/list',
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.result?.resources, 'Should return resources list');

    const uris = body.result.resources.map((r: any) => r.uri);
    assert.ok(uris.includes('ui://firstfix/diagnostic-intake.html'), 'Missing diagnostic intake');
    assert.ok(uris.includes('ui://firstfix/stocked-pro-carousel.html'), 'Missing stocked pro carousel');
    assert.ok(uris.includes('ui://firstfix/emergency-shutoff.html'), 'Missing emergency shutoff');

    const appResources = body.result.resources.filter((r: any) => r.uri.startsWith('ui://'));
    assert.strictEqual(appResources.length, 3);
    for (const r of appResources) {
      assert.strictEqual(r.mimeType, 'text/html;profile=mcp-app');
    }
  });

  // --------------------------------------------------------------------------
  // Test 3: MCP resources/read returns valid HTML with JSON-RPC postMessage bridge
  // --------------------------------------------------------------------------
  it('3. MCP resources/read returns valid HTML containing the window.parent.postMessage JSON-RPC 2.0 bridge', async () => {
    const targetUris = [
      'ui://firstfix/diagnostic-intake.html',
      'ui://firstfix/stocked-pro-carousel.html',
      'ui://firstfix/emergency-shutoff.html',
    ];

    for (const uri of targetUris) {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `req-read-${uri}`,
          method: 'resources/read',
          params: { uri },
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.result?.contents?.[0]?.text, `Resource text missing for ${uri}`);
      const html = data.result.contents[0].text;
      assert.ok(html.includes('postMessage'), `Missing postMessage in ${uri}`);
      assert.ok(html.includes('jsonrpc'), `Missing jsonrpc 2.0 in ${uri}`);
      assert.ok(html.includes('ui/initialize'), `Missing ui/initialize in ${uri}`);
    }
  });

  // --------------------------------------------------------------------------
  // Test 4: Interactive MCP App endpoints serve HTML via GET /api/mcp-apps/:appName
  // --------------------------------------------------------------------------
  it('4. GET /api/mcp-apps/:appName returns 200 OK with rendered text/html for all 3 apps', async () => {
    const apps = [
      'diagnostic-intake.html',
      'stocked-pro-carousel.html',
      'emergency-shutoff.html',
    ];

    for (const app of apps) {
      const res = await fetch(`${baseUrl}/api/mcp-apps/${app}?samplePlateId=sample_bosch_fd99`);
      assert.strictEqual(res.status, 200);
      const contentType = res.headers.get('content-type') || '';
      assert.ok(contentType.includes('text/html'), `Content-Type should be text/html, got ${contentType}`);
      const text = await res.text();
      assert.ok(text.includes('<!DOCTYPE html>'), 'Should return valid HTML document');
    }
  });

  // --------------------------------------------------------------------------
  // Test 5: Echo Show 15 Simulator Frontend Serving
  // --------------------------------------------------------------------------
  it('5. GET / and GET /app.js and GET /styles.css serve Dual-Screen Echo Show 15 simulator assets', async () => {
    const resRoot = await fetch(`${baseUrl}/`);
    assert.strictEqual(resRoot.status, 200);
    const rootHtml = await resRoot.text();
    assert.ok(rootHtml.includes('FirstFix MCP'), 'Root should contain FirstFix MCP title');
    assert.ok(rootHtml.includes('Echo Show 15'), 'Root should contain Echo Show 15 simulator');
    assert.ok(rootHtml.includes('mcp-app-iframe'), 'Root should contain MCP app iframe');

    const resAppJs = await fetch(`${baseUrl}/app.js`);
    assert.strictEqual(resAppJs.status, 200);
    const appJsText = await resAppJs.text();
    assert.ok(appJsText.includes('initiate_checkout'), 'app.js should handle initiate_checkout postMessage');

    const resCss = await fetch(`${baseUrl}/styles.css`);
    assert.strictEqual(resCss.status, 200);

    const resSim = await fetch(`${baseUrl}/simulator`);
    assert.strictEqual(resSim.status, 200);
  });

  // --------------------------------------------------------------------------
  // Test 6: Fleet & Telemetry Snapshot API
  // --------------------------------------------------------------------------
  it('6. GET /api/fleet/status returns all 4 vans, real-time inventory counts, Ring logs, and ROI metrics', async () => {
    const res = await fetch(`${baseUrl}/api/fleet/status`);
    assert.strictEqual(res.status, 200);
    const data = (await res.json()) as any;

    assert.ok(Array.isArray(data.vans), 'Should return vans array');
    assert.strictEqual(data.vans.length, 4, 'Should list all 4 contractor vans');

    const apexVan = data.vans.find((v: any) => v.vanId === 'van_apex_04');
    assert.ok(apexVan, 'Should include van_apex_04');
    assert.strictEqual(apexVan.technicianName, 'Marcus Vance');
    const pumpItem = apexVan.inventory.find((i: any) => i.oemPartSku === 'BOSCH-00631200');
    assert.ok(pumpItem, 'van_apex_04 should carry BOSCH-00631200');
    assert.strictEqual(pumpItem.quantity, 2);

    const unstockedVan = data.vans.find((v: any) => v.vanId === 'van_metro_02');
    assert.ok(unstockedVan, 'Should include unstocked van_metro_02');
    const unstockedItem = unstockedVan.inventory.find((i: any) => i.oemPartSku === 'BOSCH-00631200');
    assert.strictEqual(unstockedItem?.quantity || 0, 0);

    assert.ok(data.telemetry, 'Should return telemetry object');
    assert.strictEqual(typeof data.telemetry.preventedTruckRollsCount, 'number');
    assert.strictEqual(typeof data.telemetry.totalDollarsSavedUsd, 'number');
  });

  // --------------------------------------------------------------------------
  // Test 7: Full Interactive Checkout-to-Booking-to-Ring Pipeline
  // --------------------------------------------------------------------------
  it('7. Simulating ui/message checkout flow decrements van stock, creates booking appointment, and arms Ring access window', async () => {
    // Initial stock for BOSCH-00631200 on van_apex_04
    const statusBefore = await (await fetch(`${baseUrl}/api/fleet/status`)).json() as any;
    const apexBefore = statusBefore.vans.find((v: any) => v.vanId === 'van_apex_04');
    const initialQty = apexBefore.inventory.find((i: any) => i.oemPartSku === 'BOSCH-00631200')?.quantity || 0;

    // 1. Create UCP checkout session
    const resChk = await fetch(`${baseUrl}/checkout-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedSlotId: 'slot_apex_1400',
        oemPartSku: 'BOSCH-00631200',
        diagnosticFeeUsd: 85.0,
        bindingEstimateMinUsd: 185.0,
        bindingEstimateMaxUsd: 215.0,
        correlationToken: 'corr-test-s4-flow',
      }),
    });
    assert.strictEqual(resChk.status, 201);
    const chk = (await resChk.json()) as any;
    const sessionId = chk.id;

    // 2. Complete UCP checkout
    const resComp = await fetch(`${baseUrl}/checkout-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentConfirmationId: 'pay_s4_test_confirm_123',
      }),
    });
    assert.strictEqual(resComp.status, 200);

    // 3. Create Local Booking appointment
    const resAppt = await fetch(`${baseUrl}/v1/localbooking/businesses/contractor_apex_04/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: 'contractor_apex_04',
        technicianId: 'tech_apex_marcus_vance',
        vanId: 'van_apex_04',
        oemPartSku: 'BOSCH-00631200',
        slotId: 'slot_apex_1400',
        correlationToken: 'corr-test-s4-flow',
      }),
    });
    assert.strictEqual(resAppt.status, 201);

    // 4. Arm Ring access window
    const resRing = await fetch(`${baseUrl}/v1/ring/access-windows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId: `appt_test_s4_${Date.now()}`,
        correlationToken: 'corr-test-s4-flow',
        technicianName: 'Marcus Vance',
        vanId: 'van_apex_04',
        windowStartIso: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        windowEndIso: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
      }),
    });
    assert.strictEqual(resRing.status, 201);

    // Verify stock decremented by 1
    const statusAfter = await (await fetch(`${baseUrl}/api/fleet/status`)).json() as any;
    const apexAfter = statusAfter.vans.find((v: any) => v.vanId === 'van_apex_04');
    const afterQty = apexAfter.inventory.find((i: any) => i.oemPartSku === 'BOSCH-00631200')?.quantity;
    assert.strictEqual(afterQty, initialQty - 1, 'Van inventory should decrement by 1');
  });

  // --------------------------------------------------------------------------
  // Test 8: Blurry Plate Human-in-the-Loop Confirmation Resolution
  // --------------------------------------------------------------------------
  it('8. Blurry plate (<0.90) pauses with requires_human_confirmation, and resolves legacy BOSCH-00611332 once userConfirmedSerial is true', async () => {
    // Step 1: userConfirmedSerial is false -> Pauses at Gate
    const resPause = await fetch(`${baseUrl}/api/ai/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userUtterance: 'My Bosch dishwasher has error E24 and the serial is hard to read',
        samplePlateId: 'sample_bosch_fd98_blurry',
        userConfirmedSerial: false,
      }),
    });
    assert.strictEqual(resPause.status, 200);
    const tracePause = (await resPause.json()) as any;
    assert.strictEqual(tracePause.status, 'requires_human_confirmation', 'Should pause for human confirmation');
    assert.ok(tracePause.recommendedMcpAppResourceUri.includes('diagnostic-intake.html'), 'Should recommend intake UI');

    // Step 2: userConfirmedSerial is true -> Resolves legacy part BOSCH-00611332 ($46)
    const resConfirmed = await fetch(`${baseUrl}/api/ai/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userUtterance: 'My Bosch dishwasher has error E24 and the serial is confirmed FD980112233',
        samplePlateId: 'sample_bosch_fd98_blurry',
        userConfirmedSerial: true,
      }),
    });
    assert.strictEqual(resConfirmed.status, 200);
    const traceConfirmed = (await resConfirmed.json()) as any;
    assert.notStrictEqual(traceConfirmed.status, 'requires_human_confirmation', 'Should proceed after confirmation');
    assert.strictEqual(traceConfirmed.bomResolution?.oemPartSku, 'BOSCH-00611332', 'Should resolve legacy twist-lock pump');
    assert.strictEqual(traceConfirmed.bomResolution?.oemPartCostUsd, 46, 'Part cost should be $46');
    assert.ok(traceConfirmed.voiceResponseText.includes('FD980112233') || traceConfirmed.voiceResponseText.includes('BOSCH-00611332'));
  });

  // --------------------------------------------------------------------------
  // Test 9: Ring Arrival Verification vs Unauthorized Rejection
  // --------------------------------------------------------------------------
  it('9. Ring arrival verification grants access for Marcus Vance and rejects unauthorized tech badge', async () => {
    // Create an active window for Marcus Vance
    const now = Date.now();
    const windowStartIso = new Date(now - 10 * 60 * 1000).toISOString();
    const windowEndIso = new Date(now + 60 * 60 * 1000).toISOString();

    const resWindow = await fetch(`${baseUrl}/v1/ring/access-windows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId: 'appt_ring_test_s4',
        correlationToken: 'corr-ring-verified-token',
        technicianName: 'Marcus Vance',
        vanId: 'van_apex_04',
        windowStartIso,
        windowEndIso,
      }),
    });
    assert.strictEqual(resWindow.status, 201);
    const windowObj = (await resWindow.json()) as any;
    const windowId = windowObj.windowId;

    // Simulate Authorized Arrival
    const resAuth = await fetch(`${baseUrl}/v1/ring/simulate-arrival`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        windowId,
        correlationToken: 'corr-ring-verified-token',
        cameraDeviceId: 'ring_front_door_cam_01',
      }),
    });
    assert.strictEqual(resAuth.status, 200);
    const authData = (await resAuth.json()) as any;
    assert.strictEqual(authData.accessGranted, true, 'Authorized technician should be granted access');
    assert.strictEqual(authData.smartLockAction, 'TEMPORARY_MONITORED_UNLOCK');

    // Simulate Unauthorized Imposter Arrival (Wrong Token)
    const resUnauth = await fetch(`${baseUrl}/v1/ring/simulate-arrival`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        windowId,
        correlationToken: 'fake-unauthorized-token',
        cameraDeviceId: 'ring_front_door_cam_01',
      }),
    });
    assert.strictEqual(resUnauth.status, 403);
    const unauthData = (await resUnauth.json()) as any;
    assert.strictEqual(unauthData.accessGranted, false);
    assert.strictEqual(unauthData.reason, 'UNAUTHORIZED_OR_INVALID_CORRELATION_TOKEN');

    // Check audit logs
    const resLogs = await fetch(`${baseUrl}/v1/ring/audit-logs`);
    assert.strictEqual(resLogs.status, 200);
    const logs = (await resLogs.json()) as any;
    assert.ok(logs.events.some((l: any) => l.reason === 'VERIFIED_TECHNICIAN_CORRELATION_MATCH'));
    assert.ok(logs.events.some((l: any) => l.reason === 'UNAUTHORIZED_OR_INVALID_CORRELATION_TOKEN'));
  });

  // --------------------------------------------------------------------------
  // Test 10: Demo State Reset API
  // --------------------------------------------------------------------------
  it('10. POST /api/demo/reset restores clean seed data, reset van inventories, and clears audit trail', async () => {
    const resReset = await fetch(`${baseUrl}/api/demo/reset`, {
      method: 'POST',
    });
    assert.strictEqual(resReset.status, 200);
    const data = (await resReset.json()) as any;
    assert.strictEqual(data.status, 'reset_complete');

    // Verify van_apex_04 has quantity restored to 2
    const status = await (await fetch(`${baseUrl}/api/fleet/status`)).json() as any;
    const apex = status.vans.find((v: any) => v.vanId === 'van_apex_04');
    const pumpItem = apex.inventory.find((i: any) => i.oemPartSku === 'BOSCH-00631200');
    assert.strictEqual(pumpItem.quantity, 2, 'Quantity should be restored to initial seed (2)');
    assert.strictEqual(status.appointments.length, 0, 'Appointments should be empty');
  });
});
