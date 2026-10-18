import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { AddressInfo } from 'node:net';

import {
  resolveSerialVariantBOM,
  matchStockedContractorSlots,
} from '../src/engine/firstFixEngine.js';
import { extractRatingPlateNLP } from '../src/ai/ratingPlateVision.js';
import { appState } from '../src/server/state.js';
import { createApp } from '../src/server/app.js';
import { signOAuthToken, verifyOAuthToken } from '../src/server/oauthServer.js';

describe('Sprint 7: Production Upgrade, Zero-Fallback Remediation, OAuth 2.1 PKCE, DynamoDB Read-Back & FSM Webhooks', () => {
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
  // Test 1: Fix F-6 - 15-Brand NLP Entity Extractor (Carrier AC)
  // --------------------------------------------------------------------------
  it('1. Fix F-6: 15-Brand NLP extraction resolves Carrier AC (24ACC636A003, 2023W19482, E4) to CARRIER-HC98JA045D', () => {
    const utterance = 'My Carrier AC model 24ACC636A003 serial 2023W19482 is flashing error code E4';
    const extracted = extractRatingPlateNLP(utterance);

    assert.strictEqual(extracted.brand, 'Carrier');
    assert.strictEqual(extracted.modelNumber, '24ACC636A003');
    assert.strictEqual(extracted.serialNumber, '2023W19482');
    assert.strictEqual(extracted.errorCode, 'E4');
    assert.strictEqual(extracted.extractionSource, 'deterministic_preset_or_ocr');

    const bom = resolveSerialVariantBOM(extracted);
    assert.strictEqual(bom.status, 'MATCHED');
    assert.strictEqual(bom.oemPartSku, 'CARRIER-HC98JA045D');
    assert.strictEqual(bom.brand, 'Carrier');
    assert.strictEqual(bom.partName, '45+5 uF 370V/440V Oval Dual Run Capacitor');
  });

  // --------------------------------------------------------------------------
  // Test 2: Fix F-6 - Zero Silent Bosch Fallback for Unknown Brands
  // --------------------------------------------------------------------------
  it('2. Fix F-6: Zero silent Bosch fallback — unknown brand (Miele G7156SCVi, F11) extracts honestly and returns PART_VERIFICATION_REQUIRED', () => {
    const utterance = 'My Miele dishwasher model G7156SCVi has error F11';
    const extracted = extractRatingPlateNLP(utterance);

    assert.strictEqual(extracted.brand, 'Miele');
    assert.strictEqual(extracted.modelNumber, 'G7156SCVI');
    assert.strictEqual(extracted.errorCode, 'F11');
    assert.notStrictEqual(extracted.brand, 'Bosch', 'Must never silently fallback to Bosch for non-Bosch utterances');

    const bom = resolveSerialVariantBOM(extracted);
    assert.strictEqual(bom.status, 'PART_VERIFICATION_REQUIRED');
    assert.strictEqual(bom.brand, 'Miele');
    assert.ok(bom.verificationGuidance?.includes('not in the certified deterministic BOM catalog'));
  });

  // --------------------------------------------------------------------------
  // Test 3: Fix F-4 - Idempotent Van Part Hold with Correlation Token
  // --------------------------------------------------------------------------
  it('3. Fix F-4: Idempotent van part hold — holdPartOnVan with correlationToken decrements quantity only once', () => {
    const vanId = 'van_apex_04';
    const sku = 'BOSCH-00631200';
    const token = `corr_test_idem_${Date.now()}`;

    const initialVan = appState.getVans().find((v) => v.vanId === vanId);
    const initialPart = initialVan?.inventory.find((i) => i.oemPartSku === sku);
    const initialQty = initialPart?.quantity ?? 0;
    assert.ok(initialQty >= 2, 'Initial quantity must be at least 2');

    // First hold attempt
    const firstHold = appState.holdPartOnVan(vanId, sku, token);
    assert.strictEqual(firstHold, true, 'First hold must succeed');

    const vanAfterFirst = appState.getVans().find((v) => v.vanId === vanId);
    const qtyAfterFirst = vanAfterFirst?.inventory.find((i) => i.oemPartSku === sku)?.quantity ?? 0;
    assert.strictEqual(qtyAfterFirst, initialQty - 1, 'Quantity must decrement by exactly 1 on first hold');

    // Second hold attempt with identical correlation token (retry / idempotency replay)
    const secondHold = appState.holdPartOnVan(vanId, sku, token);
    assert.strictEqual(secondHold, true, 'Second hold with same correlationToken must return true (idempotent success)');

    const vanAfterSecond = appState.getVans().find((v) => v.vanId === vanId);
    const qtyAfterSecond = vanAfterSecond?.inventory.find((i) => i.oemPartSku === sku)?.quantity ?? 0;
    assert.strictEqual(qtyAfterSecond, initialQty - 1, 'Quantity must NOT decrement a second time on replay');
  });

  // --------------------------------------------------------------------------
  // Test 4: Fix F-4 - State Reset Clears Active Part Holds
  // --------------------------------------------------------------------------
  it('4. Fix F-4: appState.reset() clears activePartHolds so fresh holds can be granted', () => {
    const vanId = 'van_apex_04';
    const sku = 'BOSCH-00631200';
    const token = `corr_test_reset_${Date.now()}`;

    appState.holdPartOnVan(vanId, sku, token);
    appState.reset();

    const vanAfterReset = appState.getVans().find((v) => v.vanId === vanId);
    const qtyAfterReset = vanAfterReset?.inventory.find((i) => i.oemPartSku === sku)?.quantity ?? 0;
    assert.strictEqual(qtyAfterReset, 2, 'Quantity must restore to initial stock (2) on state reset');

    // Re-attempting hold with same token after reset succeeds and decrements
    const holdAfterReset = appState.holdPartOnVan(vanId, sku, token);
    assert.strictEqual(holdAfterReset, true);
    const qtyAfterNewHold = appState.getVans().find((v) => v.vanId === vanId)?.inventory.find((i) => i.oemPartSku === sku)?.quantity;
    assert.strictEqual(qtyAfterNewHold, 1, 'Quantity must decrement after reset');
  });

  // --------------------------------------------------------------------------
  // Test 5: Fix F-2 & F-5 - Dynamic Slot Dates & Computed ROI Metrics
  // --------------------------------------------------------------------------
  it('5. Fix F-2 & F-5: matchStockedContractorSlots supports dynamic slot dates and computes dynamic ROI metrics', () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const matchToday = matchStockedContractorSlots({
      oemPartSku: 'BOSCH-00631200',
      zipCode: '98101',
      preferredDateIso: todayIso,
    });

    assert.ok(matchToday.recommendedSlots.length > 0, 'Must match slots dynamically for requested date');
    assert.strictEqual(matchToday.preferredDateIso, todayIso);
    assert.strictEqual(matchToday.recommendedSlots[0].slotDate, todayIso);

    // Verify dynamic ROI metrics (F-2)
    assert.ok(matchToday.roiMetrics.estimatedSecondTruckRollSavingsUsd !== undefined);
    assert.ok(matchToday.roiMetrics.estimatedSecondTruckRollSavingsUsd! >= 120);
    assert.ok(matchToday.roiMetrics.firstTimeFixRateImprovement !== undefined);
    assert.ok(matchToday.roiMetrics.firstTimeFixRateImprovement! > 0.25);
  });

  // --------------------------------------------------------------------------
  // Test 6: Gap G-4 - OAuth 2.1 PKCE S256 Authorization Flow
  // --------------------------------------------------------------------------
  it('6. Gap G-4: OAuth 2.1 PKCE S256 authorization flow (/oauth/authorize -> /oauth/token)', async () => {
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJu1p1r_wW1gFWFOEjXk-firstfix-test-verifier';
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const authUrl = `${baseUrl}/oauth/authorize?response_type=code&client_id=firstfix_alexa_plus_client&code_challenge=${codeChallenge}&code_challenge_method=S256&format=json`;
    const authRes = await fetch(authUrl, {
      headers: { Accept: 'application/json' },
    });
    assert.strictEqual(authRes.status, 200);
    const authData = (await authRes.json()) as any;
    assert.ok(authData.code.startsWith('ff_code_'));

    const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: 'firstfix_alexa_plus_client',
        code: authData.code,
        code_verifier: codeVerifier,
      }),
    });
    assert.strictEqual(tokenRes.status, 200);
    const tokenData = (await tokenRes.json()) as any;
    assert.strictEqual(tokenData.token_type, 'Bearer');
    assert.ok(tokenData.access_token.startsWith('ff_oauth21_'));
    assert.strictEqual(tokenData.expires_in, 3600);
  });

  // --------------------------------------------------------------------------
  // Test 7: Gap G-4 - OAuth 2.1 Token Verification
  // --------------------------------------------------------------------------
  it('7. Gap G-4: OAuth 2.1 token verification (/oauth/verify) verifies valid Bearer token', async () => {
    const token = signOAuthToken({
      sub: 'alexa_user_test',
      client_id: 'firstfix_alexa_plus_client',
      scope: 'mcp:tools ucp:checkout booking:spi ring:access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'firstfix-mcp-oauth21',
    });

    const verifyRes = await fetch(`${baseUrl}/oauth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = (await verifyRes.json()) as any;
    assert.strictEqual(verifyData.active, true);
    assert.strictEqual(verifyData.client_id, 'firstfix_alexa_plus_client');
  });

  // --------------------------------------------------------------------------
  // Test 8: Gap G-4 - OAuth 2.1 Bearer Validation Middleware & RFC 9728 401
  // --------------------------------------------------------------------------
  it('8. Gap G-4: OAuth 2.1 Bearer validation middleware returns 401 with RFC 9728 WWW-Authenticate on invalid token', async () => {
    const invalidToken = 'ff_oauth21_badpayload.invalidsignature';
    const protectedRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invalidToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'oauth-test-call',
        method: 'tools/list',
      }),
    });

    assert.strictEqual(protectedRes.status, 401);
    const authHeader = protectedRes.headers.get('www-authenticate') || '';
    assert.ok(
      authHeader.includes('Bearer realm="firstfix-mcp"'),
      `Header must contain realm per RFC 9728 (got: ${authHeader})`
    );
    assert.ok(
      authHeader.includes('resource_metadata='),
      'Header must include resource_metadata link per RFC 9728'
    );
    assert.ok(
      authHeader.includes('error="invalid_token"'),
      'Header must report error="invalid_token"'
    );
  });

  // --------------------------------------------------------------------------
  // Test 9: Gap G-5 - DynamoDB Records Read-Back API
  // --------------------------------------------------------------------------
  it('9. Gap G-5: GET /api/aws/dynamo-records returns structured table status and item records', async () => {
    const res = await fetch(`${baseUrl}/api/aws/dynamo-records?limit=10`);
    assert.strictEqual(res.status, 200);
    const data = (await res.json()) as any;
    assert.strictEqual(data.tableName, 'FirstFixMcpState');
    assert.strictEqual(data.region, 'us-east-1');
    assert.ok(typeof data.itemCount === 'number');
    assert.ok(Array.isArray(data.items));
  });

  // --------------------------------------------------------------------------
  // Test 10: Gap G-8 - B2B FSM Webhook Dispatch on Booking
  // --------------------------------------------------------------------------
  it('10. Gap G-8: B2B FSM webhook dispatch creates and stores ServiceTitan / Jobber dispatch event', async () => {
    const dispatchesRes = await fetch(`${baseUrl}/v1/fsm/dispatches`);
    assert.strictEqual(dispatchesRes.status, 200);
    const data = (await dispatchesRes.json()) as any;
    assert.ok(Array.isArray(data.dispatches));
    assert.ok(data.supportedPlatforms.includes('ServiceTitan_v2'));
    assert.ok(data.supportedPlatforms.includes('HousecallPro'));
    assert.ok(data.supportedPlatforms.includes('Jobber'));
  });

  // --------------------------------------------------------------------------
  // Test 11: Gap G-8 - POST /v1/fsm/webhook-test Dispatches Test Event
  // --------------------------------------------------------------------------
  it('11. Gap G-8: POST /v1/fsm/webhook-test dispatches test event and stores it in dispatches list', async () => {
    const testPayload = {
      targetFsmPlatform: 'Jobber' as const,
      contractorId: 'contractor_apex_04',
      companyName: 'Apex Home Services',
      vanId: 'van_apex_04',
      technicianName: 'Marcus Vance',
      appointmentId: `appt_unit_${Date.now()}`,
      preDiagnosedOemSku: 'BOSCH-00631200',
      serialVariantRule: 'Manufacture date 2019+ (Batch FD99+)',
      ucpDepositPaidUsd: 85.0,
      correlationToken: `corr_fsm_test_${Date.now()}`,
    };

    const res = await fetch(`${baseUrl}/v1/fsm/webhook-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    assert.strictEqual([200, 201].includes(res.status), true, 'Must return 200 or 201 Created');
    const resData = (await res.json()) as any;
    assert.strictEqual(resData.event.targetFsmPlatform, 'Jobber');
    assert.strictEqual(resData.event.deliveryStatus, 'DELIVERED_200_OK');
    assert.ok(resData.event.fsmJobId.startsWith('JOB_'));

    const listRes = await fetch(`${baseUrl}/v1/fsm/dispatches`);
    const listData = (await listRes.json()) as any;
    const found = listData.dispatches.find((d: any) => d.eventId === resData.event.eventId);
    assert.ok(found, 'Dispatched event must be listed in FSM dispatch log');
  });

  // --------------------------------------------------------------------------
  // Test 12: Fix S-3 - Runtime Validation on POST /checkout-sessions (400 Bad Request)
  // --------------------------------------------------------------------------
  it('12. Fix S-3: Runtime validation on POST /checkout-sessions returns 400 Bad Request on invalid payload', async () => {
    // Negative diagnostic fee
    const invalidFeeRes = await fetch(`${baseUrl}/checkout-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oemPartSku: 'BOSCH-00631200',
        diagnosticFeeUsd: -50,
      }),
    });
    assert.strictEqual(invalidFeeRes.status, 400);
    const errData = (await invalidFeeRes.json()) as any;
    assert.ok(errData.code || errData.message, 'Must return error code or message');

    // Non-object body
    const nonObjRes = await fetch(`${baseUrl}/checkout-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('malformed-string'),
    });
    assert.strictEqual(nonObjRes.status, 400);
  });

  // --------------------------------------------------------------------------
  // Test 13: Fix S-3 - Runtime Validation on POST /v1/ring/simulate-arrival (400 Bad Request)
  // --------------------------------------------------------------------------
  it('13. Fix S-3: Runtime validation on POST /v1/ring/simulate-arrival returns 400 Bad Request on malformed body', async () => {
    const invalidRes = await fetch(`${baseUrl}/v1/ring/simulate-arrival`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing windowId and correlationToken
      }),
    });
    assert.strictEqual(invalidRes.status, 400);
    const errData = (await invalidRes.json()) as any;
    assert.ok(errData.code || errData.message, 'Must return error code or message');
  });

  // --------------------------------------------------------------------------
  // Test 14: Fix O-1 - Standalone packages/alexa-plus-ucp-mcp-kit Compiles Cleanly
  // --------------------------------------------------------------------------
  it('14. Fix O-1: Standalone packages/alexa-plus-ucp-mcp-kit compiles cleanly via tsconfig.json', () => {
    const sdkDir = path.resolve(process.cwd(), 'packages', 'alexa-plus-ucp-mcp-kit');
    const tsconfigPath = path.join(sdkDir, 'tsconfig.json');
    assert.ok(fs.existsSync(tsconfigPath), 'Standalone SDK tsconfig.json must exist');

    const output = execSync('npx tsc -p packages/alexa-plus-ucp-mcp-kit/tsconfig.json --noEmit', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    assert.strictEqual(output.trim(), '', 'TSC must compile packages/alexa-plus-ucp-mcp-kit with 0 errors');
  });

  // --------------------------------------------------------------------------
  // Test 15: Fix U-2 & Documentation Honesty Audit
  // --------------------------------------------------------------------------
  it('15. Fix U-2 & Documentation Honesty: GET /favicon.ico returns 204 and repo docs contain zero unbacked claims', async () => {
    let favRes;
    try {
      favRes = await fetch(`${baseUrl}/favicon.ico`, { headers: { connection: 'close' } });
    } catch {
      favRes = await fetch(`${baseUrl}/favicon.ico`, { headers: { connection: 'close' } });
    }
    assert.strictEqual(favRes.status, 204, 'GET /favicon.ico must return 204 No Content');

    const forbiddenTokens = ['Claude 3.7', 'Strands Agents SDK', 'React/Vite on Amplify', 'Amazon Polly'];
    const docsToScan = [
      path.resolve(process.cwd(), 'README.md'),
      path.resolve(process.cwd(), 'docs', 'FRICTION_LOGS_10_PERCENT_BONUS.md'),
      path.resolve(process.cwd(), 'docs', 'PRODUCT_FEEDBACK_5_PARTS.md'),
    ];

    for (const docPath of docsToScan) {
      if (fs.existsSync(docPath)) {
        const text = fs.readFileSync(docPath, 'utf-8');
        for (const token of forbiddenTokens) {
          assert.strictEqual(
            text.includes(token),
            false,
            `DOC HONESTY VIOLATION: "${token}" found in ${path.basename(docPath)}`
          );
        }
      }
    }
  });
});
