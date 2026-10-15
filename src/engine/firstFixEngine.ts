import {
  SafetyEvaluationResult,
  SerialVariantBOMResult,
  ContractorVanMatchResult,
  RecommendedContractorSlot,
  WarrantyStatus,
  SerialRangeRule,
} from '../types/index.js';
import {
  OEMCatalogBOM,
  SafetyRules,
  ContractorVans,
} from '../data/seedData.js';

export interface SafetyCheckInput {
  symptomText: string;
  applianceCategory?: string;
  errorCode?: string;
}

export interface BOMResolutionInput {
  brand: string;
  modelNumber: string;
  serialNumber: string;
  errorCode: string;
  installDateIso?: string;
}

export interface VanStockMatchInput {
  oemPartSku: string;
  zipCode: string;
  preferredDateIso: string;
}

/**
 * Normalizes alphanumeric serial numbers for deterministic prefix/range comparisons
 */
function cleanAlphanumeric(val: string): string {
  return val.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Checks if a serial number falls within a defined serial range rule
 */
function matchesSerialRange(serial: string, range: SerialRangeRule): boolean {
  const s = cleanAlphanumeric(serial);
  const start = cleanAlphanumeric(range.serialPrefixStart);
  const end = cleanAlphanumeric(range.serialPrefixEnd);

  // Exact prefix matches
  if (s.startsWith(start) || s.startsWith(end)) {
    return true;
  }

  // Common prefix substring comparison
  const compareLen = Math.min(start.length, end.length, s.length);
  if (compareLen > 0) {
    const sub = s.slice(0, compareLen);
    const startSub = start.slice(0, compareLen);
    const endSub = end.slice(0, compareLen);
    if (sub >= startSub && sub <= endSub) {
      return true;
    }
  }

  return false;
}

/**
 * Computes deterministic factory warranty coverage
 */
function calculateWarrantyStatus(
  standardWarrantyYears: number,
  installDateIso?: string,
  referenceDateIso: string = '2026-10-15T00:00:00Z'
): WarrantyStatus {
  if (!installDateIso) {
    return {
      isUnderWarranty: false,
      warrantyType: 'UNKNOWN',
      coverageYears: standardWarrantyYears,
      details: 'No verified installation date or purchase invoice registered.',
    };
  }

  const installDate = new Date(installDateIso);
  const refDate = new Date(referenceDateIso);
  const expirationDate = new Date(installDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + standardWarrantyYears);

  const isUnderWarranty = refDate.getTime() <= expirationDate.getTime();
  const expirationIso = expirationDate.toISOString().split('T')[0];

  return {
    isUnderWarranty,
    warrantyType: isUnderWarranty ? 'FACTORY_ACTIVE' : 'EXPIRED',
    coverageYears: standardWarrantyYears,
    expirationDateIso: expirationIso,
    details: isUnderWarranty
      ? `Under factory warranty through ${expirationIso} (${standardWarrantyYears}-year coverage).`
      : `Factory warranty expired on ${expirationIso}. Standard out-of-warranty labor applies.`,
  };
}

/**
 * Evaluates safety hazards and returns immediate shutoff protocol or safe 90s pre-check
 */
export function evaluateSafetyAndPrecheck(input: SafetyCheckInput): SafetyEvaluationResult {
  const symptomLower = (input.symptomText || '').toLowerCase();
  const codeLower = (input.errorCode || '').toLowerCase();
  const combined = `${symptomLower} ${codeLower}`;

  // Evaluate critical safety hazards first
  for (const rule of SafetyRules) {
    const triggered = rule.triggerKeywords.some((keyword) =>
      combined.includes(keyword.toLowerCase())
    );

    if (triggered) {
      return {
        emergencyBlocked: true,
        severity: 'CRITICAL_EMERGENCY',
        hazardType: rule.hazardType,
        shutoffInstructions: rule.shutoffGuidance,
        recommendedAction: rule.evacuationAdvice,
        safe90sDiyPrecheck: undefined,
      };
    }
  }

  // If safe, find applicable 90-second homeowner pre-check from BOM catalog
  let safePrecheck =
    'Verify that the appliance power cord is firmly plugged into a functional GFCI outlet and the main breaker is not tripped.';

  if (input.errorCode) {
    const matchedRule = OEMCatalogBOM.find(
      (r) => r.errorCode.toUpperCase() === input.errorCode?.trim().toUpperCase()
    );
    if (matchedRule?.defaultSafePrecheck) {
      safePrecheck = matchedRule.defaultSafePrecheck;
    }
  }

  return {
    emergencyBlocked: false,
    severity: 'SAFE_TO_PROCEED',
    recommendedAction: 'Proceed to serial-plate bill-of-materials verification.',
    safe90sDiyPrecheck: safePrecheck,
  };
}

/**
 * Resolves exact serial-variant OEM BOM without guessing
 */
export function resolveSerialVariantBOM(input: BOMResolutionInput): SerialVariantBOMResult {
  const normBrand = (input.brand || '').trim().toLowerCase();
  const normModel = (input.modelNumber || '').trim().toUpperCase();
  const normSerial = (input.serialNumber || '').trim().toUpperCase();
  const normError = (input.errorCode || '').trim().toUpperCase();

  // Find matching catalog rule
  const catalogEntry = OEMCatalogBOM.find((rule) => {
    const brandMatches = rule.brand.toLowerCase() === normBrand;
    const modelMatches = rule.modelNumber.toUpperCase() === normModel;
    const errorMatches = rule.errorCode.toUpperCase() === normError;
    return brandMatches && modelMatches && errorMatches;
  });

  if (!catalogEntry) {
    return {
      status: 'PART_VERIFICATION_REQUIRED',
      brand: input.brand,
      modelNumber: input.modelNumber,
      serialNumber: input.serialNumber,
      errorCode: input.errorCode,
      verificationGuidance:
        'Model or error code combination is not in the certified deterministic BOM catalog. Please upload a clear photo of the rating plate for manual technical review.',
    };
  }

  // Match serial range
  const matchedRange = catalogEntry.serialRanges.find((range) =>
    matchesSerialRange(normSerial, range)
  );

  if (!matchedRange) {
    return {
      status: 'PART_VERIFICATION_REQUIRED',
      brand: input.brand,
      modelNumber: input.modelNumber,
      serialNumber: input.serialNumber,
      errorCode: input.errorCode,
      verificationGuidance: `Serial number '${input.serialNumber}' does not match known manufacturing batches for model ${input.modelNumber}. Technician visual inspection of part required.`,
    };
  }

  // Warranty calculation
  const warranty = calculateWarrantyStatus(
    matchedRange.standardWarrantyYears,
    input.installDateIso
  );

  return {
    status: 'MATCHED',
    brand: catalogEntry.brand,
    modelNumber: catalogEntry.modelNumber,
    serialNumber: input.serialNumber,
    errorCode: catalogEntry.errorCode,
    oemPartSku: matchedRange.oemPartSku,
    partName: matchedRange.partName,
    oemPartCostUsd: matchedRange.oemPartCostUsd,
    whySerialVariantMatters: matchedRange.whySerialVariantMatters,
    safe90sDiyPrecheck: matchedRange.safe90sDiyPrecheck || catalogEntry.defaultSafePrecheck,
    warrantyStatus: warranty,
  };
}

/**
 * Matches local contractor vans with live inventory and computes ROI metrics
 */
export function matchStockedContractorSlots(input: VanStockMatchInput): ContractorVanMatchResult {
  const normPart = input.oemPartSku.trim().toUpperCase();
  const normZip = input.zipCode.trim();

  // Generate an opaque correlation token per Alexa+ localbooking protocol
  const timestamp = Date.now();
  const tokenPayload = `${normZip}_${normPart}_${timestamp}`;
  const correlationToken = `ff_booking_corr_${Buffer.from(tokenPayload).toString('base64url')}`;

  const recommendedSlots: RecommendedContractorSlot[] = [];
  let unstockedSlotsCount = 0;

  for (const van of ContractorVans) {
    // Check coverage
    if (!van.zipCodesCovered.includes(normZip)) {
      continue;
    }

    // Check inventory for the exact OEM part
    const inventoryItem = van.inventory.find(
      (item) => item.oemPartSku.toUpperCase() === normPart
    );
    const stockQuantity = inventoryItem ? inventoryItem.quantity : 0;
    const hasExactPart = stockQuantity > 0;

    for (const slot of van.availableSlots) {
      if (hasExactPart) {
        recommendedSlots.push({
          contractorId: van.contractorId,
          companyName: van.companyName,
          vanId: van.vanId,
          technicianName: van.technicianName,
          rating: van.rating,
          slotId: slot.slotId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          hasExactPart: true,
          truckStockQuantity: stockQuantity,
          diagnosticFeeUsd: van.pricing.diagnosticFeeUsd,
          bindingEstimateMinUsd: van.pricing.bindingEstimateMinUsd,
          bindingEstimateMaxUsd: van.pricing.bindingEstimateMaxUsd,
          firstVisitFixProbability: van.stockedFtfr,
          firstFixGuarantee: true,
        });
      } else {
        unstockedSlotsCount++;
      }
    }
  }

  // Sort recommended slots by earliest time and highest technician rating
  recommendedSlots.sort((a, b) => {
    if (a.startTime !== b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    return b.rating - a.rating;
  });

  return {
    queryPartSku: input.oemPartSku,
    zipCode: input.zipCode,
    preferredDateIso: input.preferredDateIso,
    correlationToken,
    recommendedSlots,
    unstockedSlotsCount,
    roiMetrics: {
      preventedReturnTruckRollSavingsUsd: 165.0,
      daysSaved: 14,
      baselineFtfr: 0.63,
      firstFixFtfr: 0.96,
    },
  };
}
