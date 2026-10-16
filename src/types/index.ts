export type ApplianceCategory =
  | 'DISHWASHER'
  | 'WATER_HEATER'
  | 'AC_CONDENSER'
  | 'WASHER'
  | 'FURNACE'
  | 'REFRIGERATOR'
  | 'DRYER'
  | 'SMART_VALVE'
  | 'OVEN'
  | 'HEAT_PUMP';

export interface SerialRangeRule {
  serialPrefixStart: string;
  serialPrefixEnd: string;
  serialPatternDescription: string;
  oemPartSku: string;
  partName: string;
  oemPartCostUsd: number;
  whySerialVariantMatters: string;
  safe90sDiyPrecheck?: string;
  standardWarrantyYears: number;
}

export interface OEMCatalogRule {
  brand: string;
  modelNumber: string;
  category: ApplianceCategory;
  errorCode: string;
  errorDescription: string;
  serialRanges: SerialRangeRule[];
  defaultSafePrecheck?: string;
}

export interface HazardShutoffRule {
  hazardType: 'GAS_LEAK' | 'CARBON_MONOXIDE' | 'ELECTRICAL_FIRE' | 'ACTIVE_FLOODING';
  triggerKeywords: string[];
  severity: 'CRITICAL_EMERGENCY';
  shutoffGuidance: string;
  evacuationAdvice: string;
}

export interface TruckInventoryItem {
  oemPartSku: string;
  quantity: number;
  partDescription: string;
}

export interface ContractorTimeSlot {
  slotId: string;
  dateIso: string;
  startTime: string;
  endTime: string;
}

export interface ContractorVan {
  contractorId: string;
  companyName: string;
  vanId: string;
  technicianName: string;
  rating: number;
  zipCodesCovered: string[];
  inventory: TruckInventoryItem[];
  availableSlots: ContractorTimeSlot[];
  pricing: {
    diagnosticFeeUsd: number;
    diagnosticCreditPercentage: number;
    bindingEstimateMinUsd: number;
    bindingEstimateMaxUsd: number;
    laborBaseRateUsd: number;
    typicalLaborHours: number;
  };
  baselineFtfr: number;
  stockedFtfr: number;
}

export interface HouseholdEquipmentRecord {
  householdId: string;
  equipmentId: string;
  brand: string;
  modelNumber: string;
  serialNumber: string;
  category: ApplianceCategory;
  installDateIso: string;
  locationInHome?: string;
  notes?: string;
  lastServiceDateIso?: string;
  updatedAtIso: string;
}

export interface SafetyEvaluationResult {
  emergencyBlocked: boolean;
  severity: 'CRITICAL_EMERGENCY' | 'SAFE_TO_PROCEED';
  hazardType?: string;
  shutoffInstructions?: string;
  recommendedAction: string;
  safe90sDiyPrecheck?: string;
}

export interface WarrantyStatus {
  isUnderWarranty: boolean;
  warrantyType: 'FACTORY_ACTIVE' | 'EXTENDED' | 'EXPIRED' | 'UNKNOWN';
  coverageYears: number;
  expirationDateIso?: string;
  details: string;
}

export interface SerialVariantBOMResult {
  status: 'MATCHED' | 'PART_VERIFICATION_REQUIRED';
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  errorCode?: string;
  oemPartSku?: string;
  partName?: string;
  oemPartCostUsd?: number;
  whySerialVariantMatters?: string;
  serialVariantRuleApplied?: string;
  safe90sDiyPrecheck?: string;
  warrantyStatus?: WarrantyStatus;
  verificationGuidance?: string;
}

export interface RecommendedContractorSlot {
  contractorId: string;
  companyName: string;
  vanId: string;
  technicianName: string;
  rating: number;
  slotId: string;
  slotDate?: string;
  startTime: string;
  endTime: string;
  hasExactPart: boolean;
  truckStockQuantity: number;
  diagnosticFeeUsd: number;
  bindingEstimateMinUsd: number;
  bindingEstimateMaxUsd: number;
  firstVisitFixProbability: number;
  firstFixGuarantee: boolean;
}

export interface ContractorVanMatchResult {
  queryPartSku: string;
  zipCode: string;
  preferredDateIso: string;
  correlationToken: string;
  recommendedSlots: RecommendedContractorSlot[];
  unstockedSlotsCount: number;
  stockedVans?: ContractorVan[];
  roiMetrics: {
    preventedReturnTruckRollSavingsUsd: number;
    daysSaved: number;
    baselineFtfr: number;
    firstFixFtfr: number;
    estimatedSecondTruckRollSavingsUsd?: number;
    firstTimeFixRateImprovement?: number;
  };
}
