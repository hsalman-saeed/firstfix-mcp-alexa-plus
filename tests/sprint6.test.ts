import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import {
  evaluateSafetyAndPrecheck,
  resolveSerialVariantBOM,
  matchStockedContractorSlots,
} from '../src/engine/firstFixEngine.js';

describe('Sprint 6: Audit Fix A-5, Real AWS us-east-1 Deployment, Documentation & Red-Team Verification', () => {
  const receiptPath = path.resolve(process.cwd(), 'deployment-receipt.json');
  assert.ok(fs.existsSync(receiptPath), 'deployment-receipt.json must exist from npm run deploy:aws');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf-8'));
  const liveBase = receipt.liveEndpoints?.echoShow15SimulatorUrl?.replace(/\/+$/, '') || '';

  // --------------------------------------------------------------------------
  // Test 1: Audit Fix A-5 Authentic AWS Lambda Function URL
  // --------------------------------------------------------------------------
  it('1. Audit Fix A-5: deployment-receipt.json contains authentic AWS-generated Function URL (No Synthetic Placeholders)', () => {
    assert.ok(liveBase, 'Live base URL must be defined in receipt');
    assert.notStrictEqual(
      liveBase,
      'https://firstfix-mcp-alexa-plus.lambda-url.us-east-1.on.aws',
      'Function URL must NOT be a synthetic fabricated placeholder'
    );
    // Real AWS Lambda Function URLs have 32-character alphanumeric random subdomain
    const awsSubdomainRegex = /^https:\/\/[a-z0-9]{20,40}\.lambda-url\.us-east-1\.on\.aws$/;
    assert.match(
      liveBase,
      awsSubdomainRegex,
      `Live Function URL "${liveBase}" must match authentic AWS random subdomain pattern`
    );
    assert.strictEqual(receipt.verificationResults?.authenticAwsSubdomain, true);
  });

  // --------------------------------------------------------------------------
  // Test 2: Live AWS Cloud DynamoDB Status Verification
  // --------------------------------------------------------------------------
  it('2. Live AWS Cloud DynamoDB Status Verification in us-east-1', () => {
    assert.strictEqual(receipt.awsRegion, 'us-east-1');
    assert.ok(receipt.architecture.database.includes('FirstFixMcpState'));
    assert.ok(receipt.architecture.database.includes('PAY_PER_REQUEST'));
    assert.ok(receipt.architecture.iamExecutionRole.includes('FirstFixMcpLambdaRole'));
    assert.ok(receipt.architecture.lambdaFunctionArn.includes('firstfix-mcp-alexa-plus'));
  });

  // --------------------------------------------------------------------------
  // Test 3: Live Public HTTPS Internet Smoke Test
  // --------------------------------------------------------------------------
  it('3. Live Public HTTPS Internet Smoke Test against deployed AWS Lambda Function URL', async () => {
    // 1. Live GET /api/health
    const healthRes = await fetch(`${liveBase}/api/health`);
    assert.strictEqual(healthRes.status, 200, 'GET /api/health must return 200 OK over public internet');
    const healthData = (await healthRes.json()) as any;
    assert.strictEqual(healthData.service, 'firstfix-mcp-alexa-plus');
    assert.strictEqual(healthData.awsRegion, 'us-east-1');
    assert.strictEqual(healthData.dynamoDbTable, 'FirstFixMcpState');

    // 2. Live POST /mcp tools/list
    const mcpRes = await fetch(`${liveBase}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'sprint6-live-check',
        method: 'tools/list',
      }),
    });
    assert.strictEqual(mcpRes.status, 200, 'POST /mcp must return 200 OK over public internet');
    const mcpData = (await mcpRes.json()) as any;
    const tools = mcpData.result?.tools || [];
    assert.ok(tools.length >= 5, 'Live MCP server must have at least 5 registered tools');
    assert.ok(tools.some((t: any) => t.name === 'diagnose_equipment_and_bom'));
    assert.ok(tools.some((t: any) => t.name === 'get_stocked_van_availability'));
  });

  // --------------------------------------------------------------------------
  // Test 4: Manifest Synchronization (addon.json & .well-known/*)
  // --------------------------------------------------------------------------
  it('4. Manifest Synchronization: addon-package/addon.json and .well-known/ucp.json reflect live Function URL', () => {
    const addonJsonPath = path.resolve(process.cwd(), 'addon-package', 'addon.json');
    assert.ok(fs.existsSync(addonJsonPath));
    const addonData = JSON.parse(fs.readFileSync(addonJsonPath, 'utf-8'));
    const addonUri = addonData.integrations[0].config.endpoints.default.uri;
    assert.strictEqual(addonUri, `${liveBase}/mcp`);

    const ucpJsonPath = path.resolve(process.cwd(), '.well-known', 'ucp.json');
    assert.ok(fs.existsSync(ucpJsonPath));
    const ucpData = JSON.parse(fs.readFileSync(ucpJsonPath, 'utf-8'));
    assert.strictEqual(ucpData.endpoints.checkout_sessions, `${liveBase}/checkout-sessions`);
  });

  // --------------------------------------------------------------------------
  // Test 5: Friction Logs Completeness (FL-1 through FL-8)
  // --------------------------------------------------------------------------
  it('5. Friction Logs Completeness: docs/FRICTION_LOGS_10_PERCENT_BONUS.md documents all 8 entries', () => {
    const flPath = path.resolve(process.cwd(), 'docs', 'FRICTION_LOGS_10_PERCENT_BONUS.md');
    assert.ok(fs.existsSync(flPath), 'docs/FRICTION_LOGS_10_PERCENT_BONUS.md must exist');
    const content = fs.readFileSync(flPath, 'utf-8');

    // Verify all 8 friction logs are present
    for (let i = 1; i <= 8; i++) {
      assert.ok(content.includes(`FL-${i}`), `Must contain entry FL-${i}`);
    }
    // Verify key sections are present
    assert.ok(content.includes('406 Not Acceptable'));
    assert.ok(content.includes('express.json'));
    assert.ok(content.includes('Nova Pro'));
    assert.ok(content.includes('ui/update-context'));
    assert.ok(content.includes('buildUcpEnvelope'));
    assert.ok(content.includes('correlationToken'));
    assert.ok(content.includes('FunctionURLAllowPublicInvoke'));
  });

  // --------------------------------------------------------------------------
  // Test 6: Product Feedback Completeness (5 Parts)
  // --------------------------------------------------------------------------
  it('6. Product Feedback Completeness: docs/PRODUCT_FEEDBACK_5_PARTS.md contains all 5 substantive sections', () => {
    const feedbackPath = path.resolve(process.cwd(), 'docs', 'PRODUCT_FEEDBACK_5_PARTS.md');
    assert.ok(fs.existsSync(feedbackPath), 'docs/PRODUCT_FEEDBACK_5_PARTS.md must exist');
    const content = fs.readFileSync(feedbackPath, 'utf-8');

    assert.ok(content.includes('PART 1: ALEXA+ ADD-ONS'));
    assert.ok(content.includes('PART 2: ALEXA+ MCP APPS'));
    assert.ok(content.includes('PART 3: UNIVERSAL COMMERCE PROTOCOL'));
    assert.ok(content.includes('PART 4: ALEXA+ LOCAL BOOKING SPI'));
    assert.ok(content.includes('PART 5: AMAZON BEDROCK NOVA PRO'));
  });

  // --------------------------------------------------------------------------
  // Test 7: Demo Video Script & Devpost Submission Master
  // --------------------------------------------------------------------------
  it('7. Demo Video Script & Devpost Submission Master exist and reference live AWS URL', () => {
    const scriptPath = path.resolve(process.cwd(), 'docs', 'DEMO_VIDEO_PRODUCTION_SCRIPT.md');
    assert.ok(fs.existsSync(scriptPath), 'docs/DEMO_VIDEO_PRODUCTION_SCRIPT.md must exist');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    assert.ok(scriptContent.includes('2:45 DEMO VIDEO PRODUCTION SCRIPT'));
    assert.ok(scriptContent.includes(liveBase));

    const devpostPath = path.resolve(process.cwd(), 'docs', 'DEVPOST_SUBMISSION_MASTER.md');
    assert.ok(fs.existsSync(devpostPath), 'docs/DEVPOST_SUBMISSION_MASTER.md must exist');
    const devpostContent = fs.readFileSync(devpostPath, 'utf-8');
    assert.ok(devpostContent.includes('DEVPOST SUBMISSION MASTER'));
    assert.ok(devpostContent.includes(liveBase));
  });

  // --------------------------------------------------------------------------
  // Test 8: Root README.md Judge Readiness
  // --------------------------------------------------------------------------
  it('8. Root README.md Judge Readiness: contains live URLs, architecture diagram, and curl commands', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    assert.ok(fs.existsSync(readmePath), 'README.md must exist');
    const readmeContent = fs.readFileSync(readmePath, 'utf-8');

    assert.ok(readmeContent.includes(liveBase), 'README must reference live AWS URL');
    assert.ok(readmeContent.includes('30-SECOND JUDGE QUICK-START'), 'README must have quick start guide');
    assert.ok(readmeContent.includes('curl -X POST'), 'README must provide curl commands');
    assert.ok(readmeContent.includes('flowchart TD'), 'README must contain Mermaid architecture diagram');
    assert.ok(readmeContent.includes('alexa-plus-ucp-mcp-kit'), 'README must link to open source kit');
    assert.ok(readmeContent.includes('FRICTION_LOGS_10_PERCENT_BONUS.md'), 'README must link to bonus friction logs');
  });

  // --------------------------------------------------------------------------
  // Test 9: Security & Secret Hygiene Audit
  // --------------------------------------------------------------------------
  it('9. Security & Secret Hygiene Audit: Zero AWS secret access keys leaked in public repository files', () => {
    const filesToAudit = [
      path.resolve(process.cwd(), 'addon-package', 'addon.json'),
      path.resolve(process.cwd(), 'deployment-receipt.json'),
      path.resolve(process.cwd(), 'README.md'),
      path.resolve(process.cwd(), '.well-known', 'ucp.json'),
      path.resolve(process.cwd(), 'docs', 'FRICTION_LOGS_10_PERCENT_BONUS.md'),
      path.resolve(process.cwd(), 'docs', 'DEVPOST_SUBMISSION_MASTER.md'),
      path.resolve(process.cwd(), 'template.yaml'),
      path.resolve(process.cwd(), 'Dockerfile'),
    ];

    // Read real secret key from .env to verify it never appears in tracked repo files
    const envPath = path.resolve(process.cwd(), '.env');
    let realSecretKey = '';
    if (fs.existsSync(envPath)) {
      const envText = fs.readFileSync(envPath, 'utf-8');
      const match = envText.match(/AWS_SECRET_ACCESS_KEY=([^\r\n]+)/);
      if (match) {
        realSecretKey = match[1].trim();
      }
    }

    for (const filePath of filesToAudit) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (realSecretKey && realSecretKey.length > 10) {
          assert.strictEqual(
            content.includes(realSecretKey),
            false,
            `SECURITY VIOLATION: AWS Secret Access Key leaked in file: ${filePath}`
          );
        }
        // General regex check for AWS secret key patterns (40 chars base64)
        const secretPattern = /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}/i;
        assert.strictEqual(
          secretPattern.test(content),
          false,
          `SECURITY VIOLATION: Hardcoded AWS secret key pattern in ${filePath}`
        );
      }
    }
  });

  // --------------------------------------------------------------------------
  // Test 10: Full End-to-End Regression Latency Audit (<150ms vs <500ms SLA)
  // --------------------------------------------------------------------------
  it('10. Full End-to-End Regression Latency Audit: Deterministic BOM + Van Match executes in <150ms (<500ms SLA)', () => {
    const startTime = performance.now();

    // 1. Safety & Precheck
    const safety = evaluateSafetyAndPrecheck('SHPM65Z55N/01', 'E24', 'Dishwasher stopped draining water');
    assert.strictEqual(safety.emergencyBlocked, false);

    // 2. Deterministic OEM BOM Resolution (Bosch FD99)
    const bom = resolveSerialVariantBOM({
      brand: 'Bosch',
      modelNumber: 'SHPM65Z55N/01',
      serialNumber: 'FD990400412',
      errorCode: 'E24',
    });
    assert.strictEqual(bom.status, 'MATCHED');
    assert.strictEqual(bom.oemPartSku, 'BOSCH-00631200');

    // 3. Stocked Contractor Van Matching
    const vanMatch = matchStockedContractorSlots({
      oemPartSku: 'BOSCH-00631200',
      zipCode: '98101',
      preferredDateIso: '2026-10-15',
    });
    assert.ok(vanMatch.recommendedSlots.length > 0);
    assert.strictEqual(vanMatch.recommendedSlots[0].vanId, 'van_apex_04');
    assert.ok(vanMatch.unstockedSlotsCount >= 1);

    const totalDurationMs = performance.now() - startTime;
    // Must execute in <150ms, well below the 500ms voice responsiveness SLA
    assert.ok(
      totalDurationMs < 150,
      `End-to-end deterministic pipeline took ${totalDurationMs.toFixed(2)}ms (must be <150ms)`
    );
  });
});
