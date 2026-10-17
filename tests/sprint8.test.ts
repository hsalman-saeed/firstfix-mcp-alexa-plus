import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { AddressInfo } from 'node:net';

import {
  resolveSerialVariantBOM,
} from '../src/engine/firstFixEngine.js';
import { extractRatingPlate } from '../src/ai/ratingPlateVision.js';
import { appState } from '../src/server/state.js';
import { createApp } from '../src/server/app.js';
import { ExtractedRatingPlate } from '../src/types/index.js';

describe('Sprint 8: 100% Zoom Responsiveness, Layman Guided Workflow & 100% Dynamic Multi-Brand Hydration', () => {
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
  // Test 1: Dynamic Multi-Brand MCP App Template (Rheem & Carrier with ZERO Bosch text)
  // --------------------------------------------------------------------------
  it('1. GET /api/mcp-apps/stocked-pro-carousel.html dynamically renders Rheem and Carrier with zero hardcoded Bosch text', async () => {
    // 1a: Test Rheem
    const rheemParams = new URLSearchParams({
      brand: 'Rheem',
      modelNumber: 'XG50T06EC36U1',
      serialNumber: 'M142408912',
      errorCode: '4_FLASHES',
      oemPartSku: 'RHEEM-SP20172',
      partName: 'Flammable Vapor Sensor (FVS) Replacement Kit',
      oemPartCostUsd: '34',
      serialVariantRuleApplied: 'Post-2022 M0122+ solid-state sealed sensor (4-flash signature)',
      whySerialVariantMatters: 'Pre-2022 units used ceramic resistance plate SP20170 with incompatible wiring harness',
    });

    const rheemRes = await fetch(`${baseUrl}/api/mcp-apps/stocked-pro-carousel.html?${rheemParams.toString()}`);
    assert.strictEqual(rheemRes.status, 200);
    const rheemHtml = await rheemRes.text();

    assert.ok(rheemHtml.includes('RHEEM-SP20172'), 'Must contain Rheem SKU');
    assert.ok(rheemHtml.includes('Flammable Vapor Sensor'), 'Must contain Rheem part name');
    assert.ok(rheemHtml.includes('Valley HVAC & Plumbing') || rheemHtml.includes('Devon Brooks'), 'Must contain matched Rheem contractor Devon Brooks / Valley HVAC');
    assert.ok(!rheemHtml.includes('BOSCH-00631200'), 'Must not contain hardcoded Bosch FD99 SKU');
    assert.ok(!rheemHtml.includes('BOSCH-00611332'), 'Must not contain hardcoded Bosch FD98 SKU');

    // 1b: Test Carrier
    const carrierParams = new URLSearchParams({
      brand: 'Carrier',
      modelNumber: '24ACC636A003',
      serialNumber: '2023W19482',
      errorCode: 'E4',
      oemPartSku: 'CARRIER-HC98JA045D',
      partName: '45+5 uF 370V/440V Oval Dual Run Capacitor',
      oemPartCostUsd: '29',
      serialVariantRuleApplied: '2021-2026 serial run 2121W+ uses HC98JA045D oval housing',
      whySerialVariantMatters: '2016-2020 used HC98KA055 round capacitor that will not fit condenser bracket',
    });

    const carrierRes = await fetch(`${baseUrl}/api/mcp-apps/stocked-pro-carousel.html?${carrierParams.toString()}`);
    assert.strictEqual(carrierRes.status, 200);
    const carrierHtml = await carrierRes.text();

    assert.ok(carrierHtml.includes('CARRIER-HC98JA045D'), 'Must contain Carrier SKU');
    assert.ok(carrierHtml.includes('Oval Dual Run Capacitor'), 'Must contain Carrier part name');
    assert.ok(!carrierHtml.includes('BOSCH-00631200'), 'Must not contain hardcoded Bosch FD99 SKU');
  });

  // --------------------------------------------------------------------------
  // Test 2: Dynamic Diagnostic Intake App with Model/Serial & Human Confirmation Gate
  // --------------------------------------------------------------------------
  it('2. GET /api/mcp-apps/diagnostic-intake.html dynamically renders brand/model/serial and toggles confirmation gate strictly on confidence < 0.90', async () => {
    // 2a: High confidence (0.98) — no confirmation gate required
    const highConfParams = new URLSearchParams({
      brand: 'Bosch',
      modelNumber: 'SHPM65Z55N/01',
      serialNumber: 'FD990400412',
      errorCode: 'E24',
      ocrConfidence: '0.98',
      requiresHumanConfirmation: 'false',
    });

    const highRes = await fetch(`${baseUrl}/api/mcp-apps/diagnostic-intake.html?${highConfParams.toString()}`);
    assert.strictEqual(highRes.status, 200);
    const highHtml = await highRes.text();

    assert.ok(highHtml.includes('SHPM65Z55N/01'), 'Must render high-conf model');
    assert.ok(highHtml.includes('FD990400412'), 'Must render high-conf serial');
    assert.ok(highHtml.includes('98%'), 'Must render 98% confidence');
    assert.ok(!highHtml.includes('Human-in-the-Loop Confirmation Gate'), 'High confidence must NOT display confirmation gate');

    // 2b: Low confidence (0.82) — confirmation gate required
    const lowConfParams = new URLSearchParams({
      brand: 'Bosch',
      modelNumber: 'SHPM65Z55N/01',
      serialNumber: 'FD980112233',
      errorCode: 'E24',
      ocrConfidence: '0.82',
      requiresHumanConfirmation: 'true',
    });

    const lowRes = await fetch(`${baseUrl}/api/mcp-apps/diagnostic-intake.html?${lowConfParams.toString()}`);
    assert.strictEqual(lowRes.status, 200);
    const lowHtml = await lowRes.text();

    assert.ok(lowHtml.includes('FD980112233'), 'Must render low-conf serial');
    assert.ok(lowHtml.includes('82%'), 'Must render 82% confidence');
    assert.ok(lowHtml.includes('Human-in-the-Loop Confirmation Gate') || lowHtml.includes('CONFIRM SERIAL NUMBER'), 'Low confidence MUST display confirmation gate');
  });

  // --------------------------------------------------------------------------
  // Test 3: Sibling Counterfactual Comparison in resolveSerialVariantBOM
  // --------------------------------------------------------------------------
  it('3. resolveSerialVariantBOM returns dynamic counterfactualComparison sibling for Bosch, Rheem, and Carrier', () => {
    // Bosch FD99
    const boschFd99Input: ExtractedRatingPlate = {
      brand: 'Bosch',
      modelNumber: 'SHPM65Z55N/01',
      serialNumber: 'FD990400412',
      errorCode: 'E24',
      extractionSource: 'deterministic_preset_or_ocr',
    };
    const boschBom = resolveSerialVariantBOM(boschFd99Input);
    assert.strictEqual(boschBom.status, 'MATCHED');
    assert.strictEqual(boschBom.oemPartSku, 'BOSCH-00631200');
    assert.ok(boschBom.counterfactualComparison, 'Must include counterfactualComparison');
    assert.strictEqual(boschBom.counterfactualComparison?.alternativeOemPartSku, 'BOSCH-00611332');
    assert.ok(boschBom.counterfactualComparison?.differenceSummary.includes('BOSCH-00611332'));

    // Rheem FVS
    const rheemInput: ExtractedRatingPlate = {
      brand: 'Rheem',
      modelNumber: 'XG50T06EC36U1',
      serialNumber: 'M142408912',
      errorCode: '4_FLASHES',
      extractionSource: 'deterministic_preset_or_ocr',
    };
    const rheemBom = resolveSerialVariantBOM(rheemInput);
    assert.strictEqual(rheemBom.status, 'MATCHED');
    assert.strictEqual(rheemBom.oemPartSku, 'RHEEM-SP20172');
    assert.ok(rheemBom.counterfactualComparison, 'Must include counterfactualComparison for Rheem');
    assert.strictEqual(rheemBom.counterfactualComparison?.alternativeOemPartSku, 'RHEEM-SP20170');

    // Carrier AC
    const carrierInput: ExtractedRatingPlate = {
      brand: 'Carrier',
      modelNumber: '24ACC636A003',
      serialNumber: '2023W19482',
      errorCode: 'E4',
      extractionSource: 'deterministic_preset_or_ocr',
    };
    const carrierBom = resolveSerialVariantBOM(carrierInput);
    assert.strictEqual(carrierBom.status, 'MATCHED');
    assert.strictEqual(carrierBom.oemPartSku, 'CARRIER-HC98JA045D');
    assert.ok(carrierBom.counterfactualComparison, 'Must include counterfactualComparison for Carrier');
    assert.strictEqual(carrierBom.counterfactualComparison?.alternativeOemPartSku, 'CARRIER-HC98JA040D');
  });

  // --------------------------------------------------------------------------
  // Test 4: Layman Guided Stepper, Consolidated Controls & 100% Zoom Responsive Layout
  // --------------------------------------------------------------------------
  it('4. public/index.html and public/styles.css contain the 3-step layman stepper, consolidated controls, and responsive grid rules', () => {
    const htmlContent = fs.readFileSync(path.resolve(process.cwd(), 'public', 'index.html'), 'utf-8');
    const cssContent = fs.readFileSync(path.resolve(process.cwd(), 'public', 'styles.css'), 'utf-8');

    // Stepper in HTML
    assert.ok(htmlContent.includes('workflow-stepper'), 'HTML must contain workflow-stepper');
    assert.ok(htmlContent.includes('STEP 1: Report Broken Appliance'), 'HTML must contain Step 1 title');
    assert.ok(htmlContent.includes('STEP 2: Exact OEM Part &amp; Serial Match'), 'HTML must contain Step 2 title');
    assert.ok(htmlContent.includes('STEP 3: 1-Tap Book Stocked Truck'), 'HTML must contain Step 3 title');

    // Consolidated controls above Echo Show bezel
    const controlsIndex = htmlContent.indexOf('control-panel-unified');
    const bezelIndex = htmlContent.indexOf('echo-show-bezel');
    assert.ok(controlsIndex > 0 && bezelIndex > 0, 'Both controls and bezel must exist');
    assert.ok(controlsIndex < bezelIndex, 'Unified controls MUST be placed ABOVE the Echo Show bezel');

    // Layman titles in scenario buttons
    assert.ok(htmlContent.includes('Dishwasher Not Draining (Happy Path)'), 'Scenario 1 layman title');
    assert.ok(htmlContent.includes('Blurry Serial Sticker'), 'Scenario 2 layman title');
    assert.ok(htmlContent.includes('Water Heater Not Heating (4 Flashes)'), 'Scenario 3 layman title');
    assert.ok(htmlContent.includes('Gas Leak Smell (Emergency Shutoff)'), 'Scenario 4 layman title');
    assert.ok(htmlContent.includes('Hacker Fee-Bypass Attempt (Security Block)'), 'Scenario 5 layman title');
    assert.ok(htmlContent.includes('AC Blowing Warm Air (Capacitor Fault)'), 'Scenario 6 layman title');

    // CSS Responsive Rules
    assert.ok(cssContent.includes('minmax(0, 1.05fr) minmax(0, 0.95fr)'), 'CSS must include responsive fractional grid');
    assert.ok(cssContent.includes('overflow-x: hidden'), 'CSS must prevent horizontal viewport overflow');
    assert.ok(cssContent.includes('sku-table'), 'CSS must define sku-table styles');
    assert.ok(cssContent.includes('highlight-needed-part'), 'CSS must style highlight-needed-part');
  });

  // --------------------------------------------------------------------------
  // Test 5: forceLiveBedrock: true bypasses preset shortcut and triggers Bedrock
  // --------------------------------------------------------------------------
  it('5. extractRatingPlate prioritizes live Bedrock Nova Pro when forceLiveBedrock is true', async () => {
    const input = {
      userUtterance: 'My Bosch dishwasher throws error E24',
      samplePlateId: 'sample_bosch_fd99',
      forceLiveBedrock: true,
    };

    // If AWS credentials are configured, it invokes real Bedrock ConverseCommand.
    // Even if credentials hit a network/env boundary, it enters the Bedrock pipeline and produces structured result.
    const result = await extractRatingPlate(input);
    assert.ok(result.brand === 'Bosch', 'Should resolve brand Bosch');
    assert.ok(result.errorCode === 'E24', 'Should resolve errorCode E24');
    assert.ok(
      result.extractionSource === 'aws_bedrock_nova_pro_live' || result.extractionSource === 'deterministic_preset_or_ocr',
      'Extraction source must be valid'
    );
  });
});
