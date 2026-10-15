import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

import {
  evaluateSafetyAndPrecheck,
  resolveSerialVariantBOM,
  matchStockedContractorSlots,
} from '../src/engine/firstFixEngine.js';
import {
  getOAuthAuthorizationServerMetadata,
  getOAuthProtectedResourceMetadata,
  getUcpDiscoveryProfile,
  OAuthAuthorizationServerMetadataSchema,
  OAuthProtectedResourceMetadataSchema,
  UcpDiscoveryProfileSchema,
} from '../src/schemas/discovery.js';
import { FirstFixStorageAdapter } from '../src/storage/storageAdapter.js';
import { OEMCatalogBOM } from '../src/data/seedData.js';

describe('Sprint 1: Monorepo Foundation & Official Manifests', () => {
  it('1. addon-package/addon.json satisfies all Alexa+ specifications and constraints', () => {
    const addonPath = path.resolve(process.cwd(), 'addon-package', 'addon.json');
    assert.ok(fs.existsSync(addonPath), 'addon.json must exist');

    const content = JSON.parse(fs.readFileSync(addonPath, 'utf-8'));
    assert.strictEqual(content.manifestVersion, '1.0');

    const listing = content.storeListing;
    assert.ok(Array.isArray(listing.distributionCountries));
    assert.ok(listing.distributionCountries.includes('US'));

    const enUs = listing.locales['en-US'];
    assert.ok(enUs, 'en-US locale must exist');
    assert.ok(enUs.name.value.length <= 30, 'Name must be <= 30 characters');
    assert.strictEqual(enUs.name.value, 'FirstFix Home Services');

    assert.ok(
      enUs.shortDescription.length <= 123,
      `shortDescription must be <= 123 chars (actual: ${enUs.shortDescription.length})`
    );
    assert.ok(enUs.fullDescription.length <= 4000, 'fullDescription must be <= 4000 chars');

    assert.strictEqual(enUs.examplePhrases.length, 4, 'Must contain 4 example phrases');
    for (const phrase of enUs.examplePhrases) {
      assert.ok(phrase.length <= 200, 'Each example phrase must be <= 200 chars');
    }

    // Privacy & compliance
    assert.ok(content.storeListing.privacyAndCompliance.privacyPolicyUrl.startsWith('https://'));
    assert.ok(content.storeListing.privacyAndCompliance.termsOfUseUrl.startsWith('https://'));

    // Media assets: all 6 required light icon sizes
    const lightIcons = content.storeListing.mediaAssets.icons.light;
    const requiredSizes = ['64x64', '72x72', '88x88', '126x126', '180x180', '241x241'];
    for (const size of requiredSizes) {
      assert.ok(lightIcons[size], `Missing light icon size: ${size}`);
      const assetFile = path.resolve(process.cwd(), 'addon-package', lightIcons[size]);
      assert.ok(fs.existsSync(assetFile), `Asset file must exist on disk: ${lightIcons[size]}`);
    }

    // Carousel image
    assert.ok(content.storeListing.mediaAssets.carouselImages[0]['600x900']);

    // MCP integration HTTPS endpoint
    const mcpIntegration = content.integrations.find((i: { type: string }) => i.type === 'MCP');
    assert.ok(mcpIntegration, 'MCP integration entry must exist');
    assert.strictEqual(mcpIntegration.config.endpoints.default.type, 'HTTPS');
    assert.ok(mcpIntegration.config.endpoints.default.uri.startsWith('https://'));
  });

  it('2. skills/firstfix-dispatch-skill/SKILL.md contains valid YAML frontmatter per agentskills.io', () => {
    const skillPath = path.resolve(process.cwd(), 'skills', 'firstfix-dispatch-skill', 'SKILL.md');
    assert.ok(fs.existsSync(skillPath), 'SKILL.md must exist');

    const raw = fs.readFileSync(skillPath, 'utf-8');
    const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatterMatch, 'SKILL.md must contain YAML frontmatter enclosed in ---');

    const frontmatter = YAML.parse(frontmatterMatch[1]);
    assert.strictEqual(frontmatter.name, 'firstfix-dispatch-skill');
    assert.ok(
      /^[a-z0-9-]+$/.test(frontmatter.name),
      'Skill name must be lowercase alphanumeric and hyphens only'
    );
    assert.ok(frontmatter.name.length <= 64, 'Skill name must be <= 64 chars');
    assert.ok(frontmatter.description.length <= 1024, 'Description must be <= 1024 chars');
    assert.strictEqual(frontmatter.license, 'MIT');
    assert.ok(frontmatter.compatibility.includes('Alexa+'));
    assert.strictEqual(frontmatter.metadata.author, 'firstfix-mcp');
    assert.strictEqual(frontmatter.metadata.version, '1.0.0');

    // Verify Markdown content covers safety prohibitions and 5-step workflow
    assert.ok(raw.includes('Strict Safety Prohibitions'));
    assert.ok(raw.includes('Five-Step Deterministic Workflow'));
    assert.ok(raw.includes('Required MCP Tool Sequence'));
  });

  it('3. Discovery schemas produce compliant OAuth 2.1, RFC 9728, and UCP metadata', () => {
    const baseUrl = 'https://mcp.firstfix.example.com';

    // OAuth 2.1
    const oauthMeta = getOAuthAuthorizationServerMetadata(baseUrl);
    const validatedOAuth = OAuthAuthorizationServerMetadataSchema.parse(oauthMeta);
    assert.ok(validatedOAuth.code_challenge_methods_supported.includes('S256'));
    assert.ok(validatedOAuth.grant_types_supported.includes('authorization_code'));
    assert.ok(validatedOAuth.token_endpoint_auth_methods_supported.includes('none'));

    // RFC 9728 Protected Resource
    const protMeta = getOAuthProtectedResourceMetadata(baseUrl);
    const validatedProt = OAuthProtectedResourceMetadataSchema.parse(protMeta);
    assert.strictEqual(validatedProt.resource, `${baseUrl}/mcp`);

    // Universal Commerce Protocol (UCP)
    const ucpMeta = getUcpDiscoveryProfile(baseUrl);
    const validatedUcp = UcpDiscoveryProfileSchema.parse(ucpMeta);
    assert.ok(validatedUcp.supported_payment_handlers.includes('com.amazon.payments.network_token'));
    assert.ok(validatedUcp.supported_payment_handlers.includes('com.amazon.payments.stored_payment_method'));
    assert.ok(validatedUcp.endpoints.checkout_sessions);

    // Static .well-known files verification
    const staticOAuth = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), '.well-known', 'oauth-authorization-server.json'), 'utf-8')
    );
    assert.ok(staticOAuth.code_challenge_methods_supported.includes('S256'));

    const staticUcp = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), '.well-known', 'ucp.json'), 'utf-8')
    );
    assert.ok(staticUcp.supported_payment_handlers.includes('com.amazon.payments.network_token'));
  });

  it('4. resolveSerialVariantBOM disambiguates Bosch E24 FD99 vs FD98 serial runs', () => {
    // FD99 serial run -> 3-Prong BLDC Pump BOSCH-00631200
    const fd99Result = resolveSerialVariantBOM({
      brand: 'Bosch',
      modelNumber: 'SHPM65Z55N/01',
      serialNumber: 'FD990400412',
      errorCode: 'E24',
      installDateIso: '2024-03-15T00:00:00Z',
    });

    assert.strictEqual(fd99Result.status, 'MATCHED');
    assert.strictEqual(fd99Result.oemPartSku, 'BOSCH-00631200');
    assert.strictEqual(fd99Result.partName, 'Bosch 3-Prong BLDC Drain Pump Assembly');
    assert.strictEqual(fd99Result.oemPartCostUsd, 42.0);
    assert.ok(fd99Result.whySerialVariantMatters?.includes('brushless DC'));
    assert.ok(fd99Result.safe90sDiyPrecheck?.includes('white plastic sump pump cover'));

    // FD98 serial run -> Legacy Twist-Lock Pump BOSCH-00611332
    const fd98Result = resolveSerialVariantBOM({
      brand: 'Bosch',
      modelNumber: 'SHPM65Z55N/01',
      serialNumber: 'FD980112233',
      errorCode: 'E24',
      installDateIso: '2018-05-10T00:00:00Z',
    });

    assert.strictEqual(fd98Result.status, 'MATCHED');
    assert.strictEqual(fd98Result.oemPartSku, 'BOSCH-00611332');
    assert.strictEqual(fd98Result.partName, 'Bosch Legacy Twist-Lock Drain Pump');
    assert.strictEqual(fd98Result.oemPartCostUsd, 46.0);
  });

  it('5. resolveSerialVariantBOM never guesses on unknown model or serial, returning PART_VERIFICATION_REQUIRED', () => {
    // Unknown model
    const unknownModelResult = resolveSerialVariantBOM({
      brand: 'Bosch',
      modelNumber: 'UNKNOWN-MODEL-999',
      serialNumber: 'FD990400412',
      errorCode: 'E24',
    });
    assert.strictEqual(unknownModelResult.status, 'PART_VERIFICATION_REQUIRED');
    assert.strictEqual(unknownModelResult.oemPartSku, undefined);
    assert.ok(unknownModelResult.verificationGuidance?.includes('not in the certified deterministic BOM catalog'));

    // Known model but unrecognized serial batch
    const unknownSerialResult = resolveSerialVariantBOM({
      brand: 'Bosch',
      modelNumber: 'SHPM65Z55N/01',
      serialNumber: 'FD800000000', // Pre-dates FD97
      errorCode: 'E24',
    });
    assert.strictEqual(unknownSerialResult.status, 'PART_VERIFICATION_REQUIRED');
    assert.strictEqual(unknownSerialResult.oemPartSku, undefined);
    assert.ok(unknownSerialResult.verificationGuidance?.includes('Technician visual inspection of part required'));
  });

  it('6. evaluateSafetyAndPrecheck immediately blocks and triggers CRITICAL_EMERGENCY on hazards', () => {
    // Gas leak
    const gasCheck = evaluateSafetyAndPrecheck({
      symptomText: 'I smell a strong gas smell like rotten eggs near the basement water heater',
      applianceCategory: 'WATER_HEATER',
    });
    assert.strictEqual(gasCheck.emergencyBlocked, true);
    assert.strictEqual(gasCheck.severity, 'CRITICAL_EMERGENCY');
    assert.strictEqual(gasCheck.hazardType, 'GAS_LEAK');
    assert.ok(gasCheck.shutoffInstructions?.includes('IMMEDIATELY EVACUATE'));

    // Carbon Monoxide
    const coCheck = evaluateSafetyAndPrecheck({
      symptomText: 'Our CO alarm is beeping and I feel dizzy near furnace in the basement',
      applianceCategory: 'FURNACE',
    });
    assert.strictEqual(coCheck.emergencyBlocked, true);
    assert.strictEqual(coCheck.severity, 'CRITICAL_EMERGENCY');
    assert.strictEqual(coCheck.hazardType, 'CARBON_MONOXIDE');

    // Electrical arcing / 240V panel
    const electricalCheck = evaluateSafetyAndPrecheck({
      symptomText: 'Appliance is sparking and burning wire smell with breaker sizzling',
      applianceCategory: 'DRYER',
    });
    assert.strictEqual(electricalCheck.emergencyBlocked, true);
    assert.strictEqual(electricalCheck.severity, 'CRITICAL_EMERGENCY');
    assert.strictEqual(electricalCheck.hazardType, 'ELECTRICAL_FIRE');

    // Active flooding
    const floodCheck = evaluateSafetyAndPrecheck({
      symptomText: 'Burst pipe under kitchen sink water gushing everywhere',
      applianceCategory: 'SMART_VALVE',
    });
    assert.strictEqual(floodCheck.emergencyBlocked, true);
    assert.strictEqual(floodCheck.severity, 'CRITICAL_EMERGENCY');
    assert.strictEqual(floodCheck.hazardType, 'ACTIVE_FLOODING');

    // Safe symptom: safe to proceed
    const safeCheck = evaluateSafetyAndPrecheck({
      symptomText: 'Dishwasher standing water in bottom tub',
      errorCode: 'E24',
      applianceCategory: 'DISHWASHER',
    });
    assert.strictEqual(safeCheck.emergencyBlocked, false);
    assert.strictEqual(safeCheck.severity, 'SAFE_TO_PROCEED');
    assert.ok(safeCheck.safe90sDiyPrecheck?.includes('white plastic sump pump cover'));
  });

  it('7. matchStockedContractorSlots excludes unstocked Van #2 and recommends Van #4 & Van #1 with exact parts', () => {
    const matchResult = matchStockedContractorSlots({
      oemPartSku: 'BOSCH-00631200',
      zipCode: '98101',
      preferredDateIso: '2026-10-15',
    });

    assert.strictEqual(matchResult.queryPartSku, 'BOSCH-00631200');
    assert.ok(matchResult.correlationToken.startsWith('ff_booking_corr_'));

    // Contractor 1 (Metro Rapid Van #2) carries BOSCH-00611332 but NOT BOSCH-00631200 (qty 0)
    const metroVanIncluded = matchResult.recommendedSlots.some(
      (slot) => slot.contractorId === 'contractor_metro_01'
    );
    assert.strictEqual(
      metroVanIncluded,
      false,
      'Metro Rapid Van #2 must be excluded because truck stock is 0 for BOSCH-00631200'
    );
    assert.ok(matchResult.unstockedSlotsCount >= 1, 'Unstocked slots must be counted');

    // Recommended slots must only include stocked vans (Apex Van #4 and Precision Van #1)
    assert.ok(matchResult.recommendedSlots.length >= 3);
    for (const slot of matchResult.recommendedSlots) {
      assert.strictEqual(slot.hasExactPart, true);
      assert.ok(slot.truckStockQuantity > 0);
      assert.strictEqual(slot.firstFixGuarantee, true);
      assert.ok(slot.diagnosticFeeUsd > 0);
      assert.ok(slot.bindingEstimateMinUsd > 0);
      assert.ok(slot.firstVisitFixProbability >= 0.94);
    }

    // Verify Apex Home Services (Marcus Vance)
    const apexSlots = matchResult.recommendedSlots.filter((s) => s.contractorId === 'contractor_apex_04');
    assert.ok(apexSlots.length >= 2);
    assert.strictEqual(apexSlots[0].technicianName, 'Marcus Vance');
    assert.strictEqual(apexSlots[0].diagnosticFeeUsd, 85.0);
    assert.strictEqual(apexSlots[0].firstVisitFixProbability, 0.96);

    // Verify Precision Trade Pros (Elena Rostova)
    const precisionSlots = matchResult.recommendedSlots.filter(
      (s) => s.contractorId === 'contractor_precision_01'
    );
    assert.ok(precisionSlots.length >= 1);
    assert.strictEqual(precisionSlots[0].technicianName, 'Elena Rostova');
    assert.strictEqual(precisionSlots[0].diagnosticFeeUsd, 79.0);
    assert.strictEqual(precisionSlots[0].firstVisitFixProbability, 0.94);

    // Check ROI metrics
    assert.strictEqual(matchResult.roiMetrics.preventedReturnTruckRollSavingsUsd, 165.0);
    assert.strictEqual(matchResult.roiMetrics.daysSaved, 14);
    assert.strictEqual(matchResult.roiMetrics.baselineFtfr, 0.63);
    assert.strictEqual(matchResult.roiMetrics.firstFixFtfr, 0.96);
  });

  it('8. Household equipment registry persists and updates state across simulated sessions', async () => {
    const storage = new FirstFixStorageAdapter({
      localFilePath: path.resolve(process.cwd(), 'data', 'test-household-registry.json'),
    });

    // Session 1: Query initial equipment
    const initialList = await storage.getHouseholdEquipment('household_demo_001');
    assert.strictEqual(initialList.length, 3);
    const dishwasher = initialList.find((e) => e.brand === 'Bosch');
    assert.ok(dishwasher);
    assert.strictEqual(dishwasher.serialNumber, 'FD990400412');

    // Simulate 7-day time jump service completion
    const serviceDate = '2026-10-22T14:30:00Z';
    const updated = await storage.updateEquipmentServiceDate(
      'household_demo_001',
      dishwasher.equipmentId,
      serviceDate,
      'Marcus Vance (Apex Home Services) replaced drain pump with BOSCH-00631200. Tested 100% operational.'
    );

    assert.ok(updated);
    assert.strictEqual(updated.lastServiceDateIso, serviceDate);
    assert.ok(updated.notes?.includes('Marcus Vance'));

    // Session 2: Read back from fresh adapter instance to verify persistence
    const storageSession2 = new FirstFixStorageAdapter({
      localFilePath: path.resolve(process.cwd(), 'data', 'test-household-registry.json'),
    });
    const session2Dishwasher = await storageSession2.getEquipmentById(
      'household_demo_001',
      dishwasher.equipmentId
    );
    assert.ok(session2Dishwasher);
    assert.strictEqual(session2Dishwasher.lastServiceDateIso, serviceDate);
    assert.ok(session2Dishwasher.notes?.includes('BOSCH-00631200'));

    // Clean up test file
    const testFile = path.resolve(process.cwd(), 'data', 'test-household-registry.json');
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  it('9. resolveSerialVariantBOM resolves Rheem FV sensor (M0122+) and Carrier capacitor (2021+)', () => {
    // Rheem Water Heater
    const rheemResult = resolveSerialVariantBOM({
      brand: 'Rheem',
      modelNumber: 'XG50T06EC36U1',
      serialNumber: 'M0423-88710',
      errorCode: '4_FLASHES',
      installDateIso: '2023-04-12T00:00:00Z',
    });
    assert.strictEqual(rheemResult.status, 'MATCHED');
    assert.strictEqual(rheemResult.oemPartSku, 'RHEEM-SP20172');
    assert.strictEqual(rheemResult.oemPartCostUsd, 34.0);
    assert.strictEqual(rheemResult.warrantyStatus?.isUnderWarranty, true);

    // Carrier AC Condenser
    const carrierResult = resolveSerialVariantBOM({
      brand: 'Carrier',
      modelNumber: '24ACC636A003',
      serialNumber: '2022-C88192',
      errorCode: 'NO_COOL_HUMMING',
      installDateIso: '2022-06-10T00:00:00Z',
    });
    assert.strictEqual(carrierResult.status, 'MATCHED');
    assert.strictEqual(carrierResult.oemPartSku, 'CARRIER-HC98JA045D');
    assert.strictEqual(carrierResult.oemPartCostUsd, 28.0);
    assert.strictEqual(carrierResult.warrantyStatus?.isUnderWarranty, true);
  });

  it('10. OEMCatalogBOM contains all 15 required realistic residential fault rules', () => {
    assert.strictEqual(OEMCatalogBOM.length, 15);
    const brands = OEMCatalogBOM.map((r) => r.brand);
    assert.ok(brands.includes('Bosch'));
    assert.ok(brands.includes('Rheem'));
    assert.ok(brands.includes('Carrier'));
    assert.ok(brands.includes('Whirlpool'));
    assert.ok(brands.includes('Trane'));
    assert.ok(brands.includes('AO Smith'));
    assert.ok(brands.includes('GE'));
    assert.ok(brands.includes('Samsung'));
    assert.ok(brands.includes('Moen'));
    assert.ok(brands.includes('KitchenAid'));
    assert.ok(brands.includes('Lennox'));
    assert.ok(brands.includes('Maytag'));
    assert.ok(brands.includes('Bradford White'));
    assert.ok(brands.includes('LG'));
  });
});
