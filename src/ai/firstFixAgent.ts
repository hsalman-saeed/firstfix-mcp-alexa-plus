import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  inspectInputSafety,
  sanitizeModelOutput,
} from './safetyGuardrails.js';
import {
  extractRatingPlate,
  ExtractedRatingPlate,
} from './ratingPlateVision.js';
import {
  resolveSerialVariantBOM,
  matchStockedContractorSlots,
  SerialVariantBOMResult,
  ContractorVanMatchResult,
} from '../engine/firstFixEngine.js';
import { appState, AppointmentRecord } from '../server/state.js';
import { ContractorVan } from '../types/index.js';

export interface AgentSkillDefinition {
  name: string;
  version: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata: {
    author: string;
    version: string;
  };
  toolsRequired: string[];
  markdownInstructions: string;
  bodyMarkdown: string;
}

export interface AgentReasoningStep {
  stepNumber: number;
  stepName: string;
  toolOrEngineCalled: string;
  latencyMs: number;
  deterministicVerified: boolean;
  summary: string;
}

export interface AgentWorkflowInput {
  userUtterance: string;
  samplePlateId?: string;
  imageBase64?: string;
  imageMimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  forceLiveBedrock?: boolean;
  zipCode?: string;
  preferredDateIso?: string;
  householdId?: string;
  userConfirmedSerial?: boolean;
  autoReserveFirstSlot?: boolean;
}

export type AgentWorkflowStatus =
  | 'halted_safety'
  | 'requires_human_confirmation'
  | 'ready_for_booking'
  | 'slot_reserved'
  | 'COMPLETED'
  | 'CRITICAL_EMERGENCY'
  | 'PROMPT_INJECTION_DETECTED'
  | 'PART_VERIFICATION_REQUIRED';

export interface AgentWorkflowResult {
  status: AgentWorkflowStatus;
  correlationToken?: string;
  extractedPlate?: ExtractedRatingPlate;
  bomResolution?: SerialVariantBOMResult;
  bomResult?: SerialVariantBOMResult;
  vanMatchResult?: ContractorVanMatchResult;
  matchedVans?: ContractorVan[];
  reservation?: {
    appointmentId: string;
    vanId: string;
    technicianName: string;
    slotStartTime: string;
    diagnosticFeeUsd: number;
    correlationToken: string;
    reserved?: boolean;
    oemPartSku?: string;
  };
  recommendedMcpAppResourceUri?: string;
  voiceResponseText: string;
  agentReasoningTrace: AgentReasoningStep[];
  reasoningTrace: AgentReasoningStep[];
  skillMetadata: {
    name: string;
    version: string;
    author: string;
  };
}

let cachedSkill: AgentSkillDefinition | null = null;

/**
 * Loads and parses skills/firstfix-dispatch-skill/SKILL.md at runtime
 */
export function loadSkillDefinition(): AgentSkillDefinition {
  if (cachedSkill) return cachedSkill;

  const skillPath = path.resolve(process.cwd(), 'skills', 'firstfix-dispatch-skill', 'SKILL.md');
  const raw = fs.readFileSync(skillPath, 'utf-8');
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatterMatch) {
    throw new Error('Invalid SKILL.md: Missing YAML frontmatter');
  }

  const frontmatter = YAML.parse(frontmatterMatch[1]);
  const markdownInstructions = raw.slice(frontmatterMatch[0].length).trim();

  cachedSkill = {
    name: frontmatter.name,
    version: frontmatter.metadata?.version || '1.0.0',
    description: frontmatter.description,
    license: frontmatter.license,
    compatibility: frontmatter.compatibility,
    metadata: {
      author: frontmatter.metadata?.author || 'firstfix-mcp',
      version: frontmatter.metadata?.version || '1.0.0',
    },
    toolsRequired: [
      'diagnose_equipment_and_bom',
      'get_stocked_van_availability',
      'reserve_part_and_slot',
      'confirm_service_booking',
    ],
    markdownInstructions,
    bodyMarkdown: markdownInstructions,
  };

  return cachedSkill;
}

export const loadAgentSkill = loadSkillDefinition;

export function getFirstFixAgentSkill(): AgentSkillDefinition | null {
  if (!cachedSkill) loadSkillDefinition();
  return cachedSkill;
}

/**
 * Executes the 5-step FirstFix Agentic Workflow
 */
export async function runFirstFixAgentWorkflow(input: AgentWorkflowInput): Promise<AgentWorkflowResult> {
  const skill = loadSkillDefinition();
  const trace: AgentReasoningStep[] = [];
  const zipCode = input.zipCode || '98101';

  // --------------------------------------------------------------------------
  // Step 1: Input Safety & Prompt-Injection Guardrail
  // --------------------------------------------------------------------------
  const t0 = performance.now();
  const safetyCheck = inspectInputSafety(input.userUtterance);
  const s1Latency = Math.round(performance.now() - t0);

  if (safetyCheck.blocked) {
    const isInjection = safetyCheck.reason === 'PROMPT_INJECTION_DETECTED';
    const stepName = isInjection ? 'Input Safety & Injection Defense' : 'Input Safety & Hazard Pre-Filter';
    const summary = isInjection
      ? 'Blocked: PROMPT_INJECTION_DETECTED - Malicious system override or price modification detected.'
      : `Blocked: CRITICAL_EMERGENCY: ${safetyCheck.hazardType || 'HAZARD_DETECTED'}. Immediate shutoff instructions dispatched.`;

    trace.push({
      stepNumber: 1,
      stepName,
      toolOrEngineCalled: 'inspectInputSafety',
      latencyMs: s1Latency,
      deterministicVerified: true,
      summary,
    });

    const resourceUri = isInjection
      ? 'ui://firstfix/diagnostic-intake.html'
      : 'ui://firstfix/emergency-shutoff.html';

    return {
      status: 'halted_safety',
      recommendedMcpAppResourceUri: resourceUri,
      voiceResponseText: safetyCheck.safeMessage || 'Action blocked due to safety protocols.',
      agentReasoningTrace: trace,
      reasoningTrace: trace,
      skillMetadata: {
        name: skill.name,
        version: skill.metadata.version,
        author: skill.metadata.author,
      },
    };
  }

  trace.push({
    stepNumber: 1,
    stepName: 'Safety Hazard & Prompt-Injection Screening',
    toolOrEngineCalled: 'inspectInputSafety',
    latencyMs: s1Latency,
    deterministicVerified: true,
    summary: 'Passed: No prompt injection or life-safety emergencies detected in utterance.',
  });

  // --------------------------------------------------------------------------
  // Step 2: Rating-Plate Multimodal Vision & Confidence Gating
  // --------------------------------------------------------------------------
  const t1 = performance.now();
  const extractedPlate = await extractRatingPlate({
    samplePlateId: input.samplePlateId,
    imageBase64: input.imageBase64,
    imageMimeType: input.imageMimeType,
    forceLiveBedrock: input.forceLiveBedrock,
    rawText: input.userUtterance,
    userConfirmedSerial: input.userConfirmedSerial,
  });
  const s2Latency = Math.round(performance.now() - t1);

  trace.push({
    stepNumber: 2,
    stepName: 'Rating-Plate Multimodal Extraction & Confidence Gating',
    toolOrEngineCalled: 'extractRatingPlate',
    latencyMs: s2Latency,
    deterministicVerified: extractedPlate.extractionSource === 'deterministic_preset_or_ocr',
    summary: `Extracted ${extractedPlate.brand} ${extractedPlate.modelNumber} (Serial: ${extractedPlate.serialNumber}, Error: ${extractedPlate.errorCode}, Confidence ${Math.round(extractedPlate.ocrConfidence * 100)}%) via ${extractedPlate.extractionSource}.`,
  });

  // Human-in-the-loop pause if confidence < 0.90 and not yet confirmed by user
  if (extractedPlate.requiresHumanConfirmation && !input.userConfirmedSerial) {
    return {
      status: 'requires_human_confirmation',
      extractedPlate,
      recommendedMcpAppResourceUri: 'ui://firstfix/diagnostic-intake.html',
      voiceResponseText:
        extractedPlate.confirmationPrompt ||
        `Please confirm Serial Number ${extractedPlate.serialNumber} on your Echo Show screen before we lock the OEM part.`,
      agentReasoningTrace: trace,
      reasoningTrace: trace,
      skillMetadata: {
        name: skill.name,
        version: skill.metadata.version,
        author: skill.metadata.author,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Step 3: Deterministic Serial-Variant OEM BOM Matching
  // --------------------------------------------------------------------------
  const t2 = performance.now();
  const bomResult = resolveSerialVariantBOM({
    brand: extractedPlate.brand,
    modelNumber: extractedPlate.modelNumber,
    serialNumber: extractedPlate.serialNumber,
    reportedErrorCode: extractedPlate.errorCode,
    symptomDescription: input.userUtterance,
    installDateIso: extractedPlate.installDateIso,
  });
  const s3Latency = Math.round(performance.now() - t2);

  trace.push({
    stepNumber: 3,
    stepName: 'Deterministic Serial-Variant BOM Resolution',
    toolOrEngineCalled: 'resolveSerialVariantBOM',
    latencyMs: s3Latency,
    deterministicVerified: true,
    summary: `Matched OEM SKU: ${bomResult.oemPartSku} (${bomResult.partName}, $${bomResult.oemPartCostUsd?.toFixed(2)}). Rule: ${bomResult.serialVariantRuleApplied}. Warranty: ${bomResult.warrantyStatus?.warrantyType}.`,
  });

  if (bomResult.status !== 'MATCHED' || !bomResult.oemPartSku) {
    return {
      status: 'PART_VERIFICATION_REQUIRED',
      extractedPlate,
      bomResolution: bomResult,
      bomResult,
      recommendedMcpAppResourceUri: 'ui://firstfix/diagnostic-intake.html',
      voiceResponseText:
        bomResult.verificationGuidance ||
        `We could not find an exact OEM part match for ${extractedPlate.brand} ${extractedPlate.modelNumber}. Please upload a clear photo of the rating plate for manual technical review.`,
      agentReasoningTrace: trace,
      reasoningTrace: trace,
      skillMetadata: {
        name: skill.name,
        version: skill.metadata.version,
        author: skill.metadata.author,
      },
    };
  }

  const oemPartSku = bomResult.oemPartSku;

  // --------------------------------------------------------------------------
  // Step 4: Stocked Contractor Van Inventory Query & ROI Matching
  // --------------------------------------------------------------------------
  const t3 = performance.now();
  const vanMatchResult = matchStockedContractorSlots({
    oemPartSku,
    zipCode,
    preferredDateIso: input.preferredDateIso || '2026-10-15',
  });
  const s4Latency = Math.round(performance.now() - t3);

  const matchedVanLabels = (vanMatchResult.stockedVans || [])
    .map((v) => `${v.companyName} (${v.vanId})`)
    .join(', ') || 'none';
  trace.push({
    stepNumber: 4,
    stepName: 'Stocked Contractor Van Matching & Second-Truck-Roll Filtering',
    toolOrEngineCalled: 'matchStockedContractorSlots',
    latencyMs: s4Latency,
    deterministicVerified: true,
    summary: `Found ${vanMatchResult.recommendedSlots.length} stocked slots across verified vans (${matchedVanLabels}, excluded ${vanMatchResult.unstockedSlotsCount} unstocked slots). Prevented return truck roll savings: $${vanMatchResult.roiMetrics.preventedReturnTruckRollSavingsUsd}.`,
  });

  // --------------------------------------------------------------------------
  // Step 5: Optional Reservation & Sanitized Voice Response Synthesis
  // --------------------------------------------------------------------------
  let reservation: AgentWorkflowResult['reservation'];

  if (input.autoReserveFirstSlot && vanMatchResult.recommendedSlots.length > 0) {
    const chosenSlot = vanMatchResult.recommendedSlots[0];
    appState.holdPartOnVan(chosenSlot.vanId, oemPartSku, vanMatchResult.correlationToken);

    const appointmentId = `appt_orch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const startTimeIso = `2026-10-15T${chosenSlot.startTime}:00Z`;
    const endTimeIso = `2026-10-15T${chosenSlot.endTime}:00Z`;

    const appt: AppointmentRecord = {
      appointmentId,
      businessId: chosenSlot.contractorId,
      serviceId: 'srv_oem_firstfix_repair',
      vanId: chosenSlot.vanId,
      technicianName: chosenSlot.technicianName,
      slotId: chosenSlot.slotId,
      startTimeIso,
      endTimeIso,
      oemPartSku,
      correlationToken: vanMatchResult.correlationToken,
      status: 'CONFIRMED',
      diagnosticFeeUsd: chosenSlot.diagnosticFeeUsd,
      bindingEstimateMinUsd: chosenSlot.bindingEstimateMinUsd,
      bindingEstimateMaxUsd: chosenSlot.bindingEstimateMaxUsd,
      partHeld: true,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };

    appState.appointments.set(appointmentId, appt);

    reservation = {
      appointmentId,
      vanId: chosenSlot.vanId,
      technicianName: chosenSlot.technicianName,
      slotStartTime: startTimeIso,
      diagnosticFeeUsd: chosenSlot.diagnosticFeeUsd,
      correlationToken: vanMatchResult.correlationToken,
      reserved: true,
      oemPartSku,
    };
  }

  // Synthesize voice response text
  let rawVoice = '';
  if (reservation) {
    rawVoice = `I've diagnosed error ${extractedPlate.errorCode} on your ${extractedPlate.brand} equipment. It requires OEM part ${oemPartSku} (${bomResult.partName}). I've locked the part on ${reservation.technicianName}'s van with ${vanMatchResult.recommendedSlots[0].companyName} for today at ${vanMatchResult.recommendedSlots[0].startTime}. Your $${reservation.diagnosticFeeUsd} diagnostic deposit is 100% credited toward repair.`;
  } else if (vanMatchResult.recommendedSlots.length > 0) {
    const top = vanMatchResult.recommendedSlots[0];
    rawVoice = `I've diagnosed error ${extractedPlate.errorCode} on your ${extractedPlate.brand} equipment. It requires OEM part ${oemPartSku}. ${top.companyName} with technician ${top.technicianName} has this exact part stocked on their van today with an opening at ${top.startTime}. Diagnostic fee is $${top.diagnosticFeeUsd.toFixed(2)}, 100% credited toward repair.`;
  } else {
    rawVoice = `I've diagnosed error ${extractedPlate.errorCode} on your ${extractedPlate.brand} equipment as requiring OEM part ${oemPartSku}. No local contractor vans currently stock this part in zip code ${zipCode}.`;
  }

  // Apply output safety sanitizer to guarantee zero hallucinated part SKUs or dangerous advice
  const sanitizedOutput = sanitizeModelOutput(rawVoice, [oemPartSku]);

  trace.push({
    stepNumber: 5,
    stepName: 'Slot & Stock Reservation',
    toolOrEngineCalled: 'sanitizeModelOutput',
    latencyMs: 1,
    deterministicVerified: true,
    summary: reservation
      ? `Confirmed appointment ${reservation.appointmentId} with ${reservation.technicianName} (${reservation.vanId}). Reserved OEM part ${reservation.oemPartSku}. Synthesized safe voice response.`
      : 'Synthesized safe voice response without reservation.',
  });

  const finalStatus = reservation ? 'slot_reserved' : 'ready_for_booking';

  return {
    status: finalStatus,
    correlationToken: vanMatchResult.correlationToken,
    extractedPlate,
    bomResolution: bomResult,
    bomResult,
    vanMatchResult,
    matchedVans: vanMatchResult.stockedVans,
    reservation,
    recommendedMcpAppResourceUri: 'ui://firstfix/stocked-pro-carousel.html',
    voiceResponseText: sanitizedOutput.safeNarrative,
    agentReasoningTrace: trace,
    reasoningTrace: trace,
    skillMetadata: {
      name: skill.name,
      version: skill.metadata.version,
      author: skill.metadata.author,
    },
  };
}
