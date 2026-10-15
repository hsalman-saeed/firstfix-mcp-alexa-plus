import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import YAML from 'yaml';

import { createApp } from '../src/server/app.js';
import { resetAppState } from '../src/server/state.js';
import {
  normalizeMcpStreamableHeaders,
  createUcpIdempotencyStore,
  buildUcpEnvelope,
  createCorrelationTokenBridge,
  validateAddonImageDimensions,
} from '../packages/alexa-plus-ucp-mcp-kit/src/index.js';
import { handler, closeLambdaServer } from '../src/aws/lambdaHandler.js';
import {
  getDynamoStatus,
  persistRecordAsync,
  checkDynamoConnection,
} from '../src/aws/dynamoPersistence.js';

describe('Sprint 5: Standalone Open Source SDK, devices-agent-skills & AWS us-east-1 Deployment', () => {
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
    await closeLambdaServer();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // --------------------------------------------------------------------------
  // Test 1: SDK normalizeMcpStreamableHeaders
  // --------------------------------------------------------------------------
  it('1. alexa-plus-ucp-mcp-kit: normalizeMcpStreamableHeaders ensures both application/json and text/event-stream', () => {
    // Case A: Missing Accept header
    const headersA = normalizeMcpStreamableHeaders({ 'content-type': 'application/json' });
    assert.ok(headersA['accept'].includes('text/event-stream'));
    assert.ok(headersA['accept'].includes('application/json'));

    // Case B: Client only requested application/json
    const headersB = normalizeMcpStreamableHeaders({ accept: 'application/json' });
    assert.ok(headersB['accept'].includes('text/event-stream'));
    assert.ok(headersB['accept'].includes('application/json'));

    // Case C: Preserves casing normalization and existing headers
    const headersC = normalizeMcpStreamableHeaders({
      Accept: 'text/event-stream',
      'X-Correlation-Token': 'corr_123',
    });
    assert.strictEqual(headersC['x-correlation-token'], 'corr_123');
    assert.ok(headersC['accept'].includes('application/json'));
    assert.ok(headersC['accept'].includes('text/event-stream'));
  });

  // --------------------------------------------------------------------------
  // Test 2: SDK createUcpIdempotencyStore (409 Conflict Detection)
  // --------------------------------------------------------------------------
  it('2. alexa-plus-ucp-mcp-kit: createUcpIdempotencyStore caches 24h responses and rejects mutated bodies with 409', () => {
    const store = createUcpIdempotencyStore(86400000);
    const key = 'idem_key_s5_test_001';
    const body1 = { slotId: 'slot_apex_1400', deposit: 85.0 };
    const responseData = { id: 'chk_s5_1', status: 'incomplete' };

    // Record initial call
    store.set(key, body1, 201, responseData);

    // Exact replay -> hit: true, conflict: false
    const replay = store.get(key, body1);
    assert.strictEqual(replay.hit, true);
    assert.strictEqual(replay.conflict, false);
    assert.strictEqual(replay.record?.statusCode, 201);
    assert.strictEqual(replay.record?.responseBody.id, 'chk_s5_1');

    // Mutated replay -> hit: true, conflict: true
    const bodyMutated = { slotId: 'slot_apex_1400', deposit: 99.0 }; // altered deposit
    const mutatedCheck = store.get(key, bodyMutated);
    assert.strictEqual(mutatedCheck.hit, true);
    assert.strictEqual(mutatedCheck.conflict, true);
  });

  // --------------------------------------------------------------------------
  // Test 3: SDK buildUcpEnvelope & createCorrelationTokenBridge
  // --------------------------------------------------------------------------
  it('3. alexa-plus-ucp-mcp-kit: buildUcpEnvelope and createCorrelationTokenBridge generate valid protocols', () => {
    const bridge = createCorrelationTokenBridge('test-secret-s5');
    const token = bridge.generateToken({
      sessionId: 'chk_token_test_123',
      appointmentId: 'appt_456',
      vanId: 'van_apex_04',
    });

    assert.ok(token.startsWith('corr_'));
    const verified = bridge.verifyToken(token);
    assert.strictEqual(verified.valid, true);
    assert.ok(verified.payload?.includes('chk_token_test_123'));
    assert.ok(verified.payload?.includes('van_apex_04'));

    // Corrupted token check
    const forgedToken = `${token.slice(0, -4)}ffff`;
    assert.strictEqual(bridge.verifyToken(forgedToken).valid, false);

    // Build UCP envelope
    const envelope = buildUcpEnvelope({
      id: 'chk_env_001',
      status: 'completed',
      correlationToken: token,
      diagnosticFeeUsd: 85.0,
      bindingEstimateMinUsd: 185.0,
      bindingEstimateMaxUsd: 215.0,
      paymentConfirmationId: 'pay_conf_s5_999',
    });

    assert.strictEqual(envelope.ucp.version, '2026-01-11');
    assert.strictEqual(envelope.ucp.profile, 'dev.ucp.shopping.checkout');
    assert.strictEqual(envelope.checkout_session.status, 'completed');
    assert.strictEqual(envelope.checkout_session.correlationToken, token);
    assert.strictEqual(envelope.checkout_session.payment.deposit_collected_usd, 85.0);
  });

  // --------------------------------------------------------------------------
  // Test 4: SDK validateAddonImageDimensions
  // --------------------------------------------------------------------------
  it('4. alexa-plus-ucp-mcp-kit: validateAddonImageDimensions validates PNG IHDR headers accurately', () => {
    const iconPath = path.resolve(process.cwd(), 'addon-package', 'assets', 'icon_180x180.png');
    assert.ok(fs.existsSync(iconPath), 'icon_180x180.png must exist');
    const iconBuf = fs.readFileSync(iconPath);

    // Check valid 180x180
    const check180 = validateAddonImageDimensions(iconBuf, 180, 180);
    assert.strictEqual(check180.valid, true);
    assert.strictEqual(check180.actualWidth, 180);
    assert.strictEqual(check180.actualHeight, 180);

    // Check mismatch detection
    const checkWrong = validateAddonImageDimensions(iconBuf, 1200, 800);
    assert.strictEqual(checkWrong.valid, false);
    assert.ok(checkWrong.error?.includes('Expected 1200x800'));

    // Check invalid non-PNG buffer
    const badBuf = Buffer.from('NOT_A_PNG_FILE_HEADER_TEST');
    const checkBad = validateAddonImageDimensions(badBuf, 512, 512);
    assert.strictEqual(checkBad.valid, false);
    assert.ok(checkBad.error?.includes('Invalid PNG signature'));
  });

  // --------------------------------------------------------------------------
  // Test 5: Open Source Contribution Skill Manifest
  // --------------------------------------------------------------------------
  it('5. open-source-contribution: SKILL.md contains valid YAML frontmatter and pull request template exists', () => {
    const skillPath = path.resolve(
      process.cwd(),
      'open-source-contribution',
      'devices-agent-skills',
      'skills',
      'alexa-plus-mcp-ucp-local-booking',
      'SKILL.md'
    );
    assert.ok(fs.existsSync(skillPath), 'Community SKILL.md must exist');
    const rawSkill = fs.readFileSync(skillPath, 'utf-8');

    const frontmatterMatch = rawSkill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatterMatch, 'SKILL.md must have YAML frontmatter');

    const frontmatter = YAML.parse(frontmatterMatch[1]);
    assert.strictEqual(frontmatter.name, 'alexa-plus-mcp-ucp-local-booking');
    assert.strictEqual(frontmatter.license, 'MIT');
    assert.ok(frontmatter.description);

    const prPath = path.resolve(
      process.cwd(),
      'open-source-contribution',
      'devices-agent-skills',
      'PULL_REQUEST_TEMPLATE.md'
    );
    assert.ok(fs.existsSync(prPath), 'PULL_REQUEST_TEMPLATE.md must exist');
  });

  // --------------------------------------------------------------------------
  // Test 6: Dynamic Base URL Resolution
  // --------------------------------------------------------------------------
  it('6. Dynamic Base URL resolution adapts to x-forwarded-proto and x-forwarded-host headers', async () => {
    const liveDomain = 'firstfix-test.lambda-url.us-east-1.on.aws';

    const resUcp = await fetch(`${baseUrl}/.well-known/ucp`, {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': liveDomain,
      },
    });
    assert.strictEqual(resUcp.status, 200);
    const ucpData = (await resUcp.json()) as any;
    assert.ok(ucpData.endpoints.checkout_sessions.startsWith(`https://${liveDomain}`));

    const resOAuth = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`, {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': liveDomain,
      },
    });
    assert.strictEqual(resOAuth.status, 200);
    const oauthData = (await resOAuth.json()) as any;
    assert.strictEqual(oauthData.issuer, `https://${liveDomain}`);
    assert.strictEqual(oauthData.authorization_endpoint, `https://${liveDomain}/oauth/authorize`);
  });

  // --------------------------------------------------------------------------
  // Test 7: GET /api/health and /api/aws/architecture-status
  // --------------------------------------------------------------------------
  it('7. GET /api/health and /api/aws/architecture-status return complete AWS telemetry', async () => {
    const resHealth = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(resHealth.status, 200);
    const health = (await resHealth.json()) as any;

    assert.strictEqual(health.service, 'firstfix-mcp-alexa-plus');
    assert.strictEqual(health.awsRegion, 'us-east-1');
    assert.strictEqual(health.bedrockModelId, 'us.amazon.nova-pro-v1:0');
    assert.strictEqual(health.dynamoDbTable, 'FirstFixMcpState');
    assert.ok(health.mcpEndpoint.endsWith('/mcp'));
    assert.ok(health.ucpDiscoveryEndpoint.endsWith('/.well-known/ucp'));

    const resArch = await fetch(`${baseUrl}/api/aws/architecture-status`);
    assert.strictEqual(resArch.status, 200);
    const arch = (await resArch.json()) as any;
    assert.strictEqual(arch.mcpSpecVersion, '2025-11-25');
  });

  // --------------------------------------------------------------------------
  // Test 8: Lambda Function URL Express Bridge (lambdaHandler)
  // --------------------------------------------------------------------------
  it('8. lambdaHandler processes APIGatewayProxyEventV2 for GET /api/health and POST /mcp', async () => {
    // 1. Test GET /api/health through Lambda handler
    const eventHealth = {
      rawPath: '/api/health',
      headers: { host: 'lambda-test.on.aws' },
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/health',
          protocol: 'HTTP/1.1',
        },
        domainName: 'lambda-test.on.aws',
      },
    };

    const resHealth = await handler(eventHealth);
    assert.strictEqual(resHealth.statusCode, 200);
    const parsedHealth = JSON.parse(resHealth.body || '{}');
    assert.strictEqual(parsedHealth.service, 'firstfix-mcp-alexa-plus');
    assert.strictEqual(parsedHealth.publicBaseUrl, 'https://lambda-test.on.aws');

    // 2. Test POST /mcp tools/list through Lambda handler
    const eventMcp = {
      rawPath: '/mcp',
      headers: {
        host: 'lambda-test.on.aws',
        'content-type': 'application/json',
      },
      requestContext: {
        http: {
          method: 'POST',
          path: '/mcp',
          protocol: 'HTTP/1.1',
        },
        domainName: 'lambda-test.on.aws',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'lambda-test-mcp-1',
        method: 'tools/list',
      }),
    };

    const resMcp = await handler(eventMcp);
    assert.strictEqual(resMcp.statusCode, 200);
    const parsedMcp = JSON.parse(resMcp.body || '{}');
    assert.ok(parsedMcp.result?.tools?.length >= 5);
  });

  // --------------------------------------------------------------------------
  // Test 9: DynamoDB Async Non-blocking Persistence Status
  // --------------------------------------------------------------------------
  it('9. dynamoPersistence handles status inspection and non-blocking asynchronous state writes', async () => {
    const status = getDynamoStatus();
    assert.ok(status.tableName === 'FirstFixMcpState');
    assert.ok(status.region === 'us-east-1');
    assert.ok(status.status === 'connected_us_east_1' || status.status === 'in_memory_fallback');

    // Verify non-blocking async persist call executes without throwing
    assert.doesNotThrow(() => {
      persistRecordAsync('APPOINTMENT#TEST_S5', 'RECORD_001', {
        appointmentId: 'appt_test_s5_001',
        vanId: 'van_apex_04',
        oemPartSku: 'BOSCH-00631200',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Test 10: Live AWS Deployment Receipt Verification
  // --------------------------------------------------------------------------
  it('10. Live AWS Deployment configuration & IaC templates satisfy production requirements', () => {
    // 1. Verify SAM template exists and defines Lambda Function URL and DynamoDB
    const templatePath = path.resolve(process.cwd(), 'template.yaml');
    assert.ok(fs.existsSync(templatePath), 'template.yaml must exist');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    assert.ok(templateContent.includes('FirstFixMcpStateTable'));
    assert.ok(templateContent.includes('FunctionUrlConfig'));
    assert.ok(templateContent.includes('FirstFixMcpFunction'));

    // 2. Verify Dockerfile exists
    const dockerfilePath = path.resolve(process.cwd(), 'Dockerfile');
    assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist');

    // 3. If deployment-receipt.json exists, verify structure
    const receiptPath = path.resolve(process.cwd(), 'deployment-receipt.json');
    if (fs.existsSync(receiptPath)) {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf-8'));
      assert.ok(receipt.liveEndpoints.echoShow15SimulatorUrl.includes('lambda-url.us-east-1.on.aws'));
      assert.ok(receipt.liveEndpoints.mcp20251125StreamableHttp.includes('/mcp'));
      assert.strictEqual(receipt.verificationResults.healthCheckStatus, 200);
      assert.strictEqual(receipt.verificationResults.ucpDiscoveryStatus, 200);
      assert.ok(receipt.verificationResults.mcpToolsCount >= 5);
    }
  });
});
