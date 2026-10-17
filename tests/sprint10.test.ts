/**
 * Sprint 10 Verification Test Suite: Infinite Height Growth Elimination
 * & Household Equipment & Active Warranty Registry Verification (90/90 Passing Tests)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { createApp } from '../src/server/app.js';
import { appState } from '../src/server/state.js';
import { defaultStorage } from '../src/storage/storageAdapter.js';
import {
  renderDiagnosticIntakeHtml,
  renderStockedProCarouselHtml,
  renderEmergencyShutoffHtml,
} from '../src/mcp/uiTemplates.js';

describe('Sprint 10: Infinite Height Growth Loop Elimination & Household Equipment Registry (5 Tests -> 90/90 Total)', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    appState.resetAppState();
    defaultStorage.resetToSeed();
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
  // Test 1: Iframe Template Infinite Height Growth Loop Elimination
  // --------------------------------------------------------------------------
  it('1. src/mcp/uiTemplates.ts eliminates ResizeObserver, uses height: auto !important, wraps content in #mcp-app-root, and measures offsetHeight', () => {
    const templatesPath = path.join(process.cwd(), 'src', 'mcp', 'uiTemplates.ts');
    const templatesSrc = fs.readFileSync(templatesPath, 'utf-8');

    // 1. Must NOT contain ResizeObserver
    assert.ok(!templatesSrc.includes('ResizeObserver'), 'uiTemplates.ts must NOT contain ResizeObserver to prevent infinite growth loops');

    // 2. Must NOT measure documentElement.scrollHeight
    assert.ok(!templatesSrc.includes('documentElement.scrollHeight'), 'uiTemplates.ts must NOT measure documentElement.scrollHeight');

    // 3. Must use height: auto !important
    assert.ok(templatesSrc.includes('height: auto !important;'), 'uiTemplates.ts must use height: auto !important');

    // 4. Must wrap content in mcp-app-root and measure offsetHeight
    assert.ok(templatesSrc.includes('id="mcp-app-root"'), 'uiTemplates.ts must wrap inner content in #mcp-app-root');
    assert.ok(templatesSrc.includes('root.offsetHeight'), 'uiTemplates.ts notifyHeight must measure root.offsetHeight');

    // 5. Verify all 3 rendered templates contain #mcp-app-root and notifyHeight
    const diag = renderDiagnosticIntakeHtml();
    const stocked = renderStockedProCarouselHtml();
    const emergency = renderEmergencyShutoffHtml();

    assert.ok(diag.includes('id="mcp-app-root"'), 'diagnostic-intake must render #mcp-app-root');
    assert.ok(diag.includes('notifyHeight()'), 'diagnostic-intake must invoke notifyHeight()');

    assert.ok(stocked.includes('id="mcp-app-root"'), 'stocked-pro-carousel must render #mcp-app-root');
    assert.ok(stocked.includes('notifyHeight()'), 'stocked-pro-carousel must invoke notifyHeight()');

    assert.ok(emergency.includes('id="mcp-app-root"'), 'emergency-shutoff must render #mcp-app-root');
    assert.ok(emergency.includes('notifyHeight()'), 'emergency-shutoff must invoke notifyHeight()');
  });

  // --------------------------------------------------------------------------
  // Test 2: public/app.js Strict Height Clamping [420px, 640px] with Deadband
  // --------------------------------------------------------------------------
  it('2. public/app.js clamps ui/resize strictly between 420px and 640px without recursive +28px additions', () => {
    const appJsPath = path.join(process.cwd(), 'public', 'app.js');
    const appJs = fs.readFileSync(appJsPath, 'utf-8');

    // Must clamp between 420 and 640 in ui/resize
    assert.ok(
      appJs.includes('Math.min(640, Math.max(420,'),
      'public/app.js must clamp ui/resize and iframe.onload between 420 and 640'
    );

    // Must NOT add rawH + 28 in ui/resize
    assert.ok(
      !appJs.includes('height + 28') && !appJs.includes('msg.params.height + 28') && !appJs.includes('data.params?.height + 28'),
      'public/app.js ui/resize listener must not add + 28 recursively'
    );

    // Must have deadband check
    assert.ok(
      appJs.includes('Math.abs(targetHeight - currentHeight) > 4'),
      'public/app.js must include deadband threshold check > 4 to prevent flutter'
    );
  });

  // --------------------------------------------------------------------------
  // Test 3: GET /api/household/registry Returns Appliances & Active Warranties
  // --------------------------------------------------------------------------
  it('3. GET /api/household/registry returns 200 OK with registered household equipment and active warranty statuses', async () => {
    const res = await fetch(`${baseUrl}/api/household/registry`);
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.appliances), 'appliances must be an array');
    assert.ok(body.appliances.length >= 3, 'Must contain at least 3 pre-seeded household appliances');

    // Verify Bosch Dishwasher
    const dishwasher = body.appliances.find((a: any) => a.brand === 'Bosch');
    assert.ok(dishwasher, 'Bosch appliance must exist in registry');
    assert.ok(dishwasher.category === 'DISHWASHER' || dishwasher.category === 'Dishwasher');
    assert.ok(dishwasher.warrantyStatus === 'UNDER_WARRANTY' || dishwasher.warrantyStatus === 'EXPIRED');

    // Verify Rheem Water Heater
    const waterHeater = body.appliances.find((a: any) => a.brand === 'Rheem');
    assert.ok(waterHeater, 'Rheem appliance must exist in registry');
    assert.ok(waterHeater.category === 'WATER_HEATER' || waterHeater.category === 'Water Heater');

    // Verify Carrier AC
    const ac = body.appliances.find((a: any) => a.brand === 'Carrier');
    assert.ok(ac, 'Carrier appliance must exist in registry');
    assert.ok(ac.category === 'AC_CONDENSER' || ac.category === 'Air Conditioner');
  });

  // --------------------------------------------------------------------------
  // Test 4: Live Orchestration Persists & Updates Household Registry
  // --------------------------------------------------------------------------
  it('4. Running an orchestration automatically records/updates diagnosed appliance in GET /api/household/registry', async () => {
    // Run an orchestration for Bosch Dishwasher FD99
    const orchRes = await fetch(`${baseUrl}/api/ai/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance: 'My Bosch dishwasher stopped draining and displays error code E24.',
        scenarioId: 1,
        platePresetId: 'sample_bosch_fd99',
      }),
    });

    assert.strictEqual(orchRes.status, 200);

    // Query household registry to ensure diagnosed SKU is persisted
    const regRes = await fetch(`${baseUrl}/api/household/registry`);
    assert.strictEqual(regRes.status, 200);
    const body: any = await regRes.json();
    const bosch = body.appliances.find((a: any) => a.brand === 'Bosch');
    assert.ok(bosch, 'Bosch appliance must exist');
    assert.strictEqual(bosch.lastDiagnosedSku, 'BOSCH-00631200', 'Bosch lastDiagnosedSku must be updated');
  });

  // --------------------------------------------------------------------------
  // Test 5: UI Inspection of Household Equipment & Active Warranty Registry
  // --------------------------------------------------------------------------
  it('5. public/index.html & public/app.js feature the Household Equipment & Active Warranty Registry UI', () => {
    const indexHtml = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf-8');
    const appJs = fs.readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf-8');

    // Check HTML card and elements
    assert.ok(indexHtml.includes('id="household-registry-card"'), 'index.html must have household-registry-card');
    assert.ok(indexHtml.includes('id="household-registry-table"'), 'index.html must have household-registry-table');
    assert.ok(indexHtml.includes('id="household-registry-tbody"'), 'index.html must have household-registry-tbody');
    assert.ok(indexHtml.includes('id="btn-refresh-household"'), 'index.html must have btn-refresh-household');

    // Check App.js function and listener
    assert.ok(appJs.includes('fetchHouseholdRegistry'), 'app.js must define fetchHouseholdRegistry');
    assert.ok(appJs.includes('/api/household/registry'), 'app.js must call /api/household/registry');
    assert.ok(appJs.includes('btn-refresh-household'), 'app.js must bind btn-refresh-household click');
  });
});
