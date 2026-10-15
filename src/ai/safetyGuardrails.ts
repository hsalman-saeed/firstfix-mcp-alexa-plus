import { evaluateSafetyAndPrecheck } from '../engine/firstFixEngine.js';

export interface InputSafetyResult {
  blocked: boolean;
  safe: boolean;
  reason?: 'PROMPT_INJECTION_DETECTED' | 'CRITICAL_EMERGENCY';
  safeMessage?: string;
  hazardType?: string;
  shutoffInstructions?: string;
  recommendedAction?: string;
  sanitizedInput?: string;
}

export interface SanitizedModelOutputResult {
  sanitizedText: string;
  safeNarrative: string;
  strippedDangerousPhrases: boolean;
  hasDangerousInstructions: boolean;
  flaggedPhrases: string[];
  rejectedHallucinatedSkus: string[];
  hallucinatedSkus: string[];
  hasHallucinatedSku: boolean;
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /system\s+override/i,
  /set\s+price\s+to\s+\$0/i,
  /set\s+(?:the\s+)?(?:diagnostic\s+)?fee\s+to\s+\$?0/i,
  /bypass\s+(?:ucp\s+)?checkout/i,
  /bypass\s+payment/i,
  /print\s+system\s+prompt/i,
  /reveal\s+(?:internal\s+)?prompt/i,
  /developer\s+mode\s+enabled/i,
  /dan\s+mode/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
];

const DANGEROUS_DIY_PATTERNS: Array<{ pattern: RegExp; phrase: string; replacement: string }> = [
  {
    pattern: /open\s+(?:the\s+)?(?:240v\s+)?(?:breaker|electrical)\s+panel/gi,
    phrase: 'open the breaker panel',
    replacement: '[PROHIBITED: Electrical panels must only be serviced by licensed electricians]',
  },
  {
    pattern: /discharge\s+(?:the\s+)?capacitor(?:\s+with\s+a\s+screwdriver)?/gi,
    phrase: 'discharge the capacitor with a screwdriver',
    replacement: '[PROHIBITED: High-voltage capacitors store lethal charge and must only be handled by HVAC technicians]',
  },
  {
    pattern: /(?:disconnect|adjust|service)\s+(?:the\s+)?gas\s+valve/gi,
    phrase: 'disconnect the gas valve',
    replacement: '[PROHIBITED: Gas controls require certified gas-fitter tooling]',
  },
  {
    pattern: /jumper\s+(?:the\s+)?(?:240v\s+)?relay/gi,
    phrase: 'jumper the 240v relay',
    replacement: '[PROHIBITED: Bypassing relays creates immediate fire hazard]',
  },
  {
    pattern: /bypass\s+(?:the\s+)?safety\s+switch/gi,
    phrase: 'bypass the safety switch',
    replacement: '[PROHIBITED: Safety switches must never be bypassed]',
  },
];

/**
 * Inspects incoming user input for prompt injection and life-safety hazards
 */
export function inspectInputSafety(rawInput: string): InputSafetyResult {
  const input = rawInput || '';

  // 1. Prompt-Injection Detection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        blocked: true,
        safe: false,
        reason: 'PROMPT_INJECTION_DETECTED',
        safeMessage:
          'Safety system triggered: Input contains restricted system control instructions. FirstFix operations must follow verified diagnostic protocols.',
      };
    }
  }

  // 2. Life-Safety Hazard Pre-Inference Screening
  const safetyEval = evaluateSafetyAndPrecheck({
    symptomText: input,
  });

  if (safetyEval.emergencyBlocked) {
    return {
      blocked: true,
      safe: false,
      reason: 'CRITICAL_EMERGENCY',
      hazardType: safetyEval.hazardType,
      shutoffInstructions: safetyEval.shutoffInstructions,
      recommendedAction: safetyEval.recommendedAction,
      safeMessage: `CRITICAL HAZARD DETECTED (${safetyEval.hazardType}): Standard diagnostics and bookings are blocked. ${safetyEval.shutoffInstructions || ''} ${safetyEval.recommendedAction || ''}`.trim(),
    };
  }

  return {
    blocked: false,
    safe: true,
    sanitizedInput: input.trim(),
  };
}

/**
 * Redacts PII (phone, email, street address) before writing to logs/telemetry
 */
export function redactPiiForLogs(text: string): string {
  if (!text) return '';
  let sanitized = text;

  // Mask phone numbers
  sanitized = sanitized.replace(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    '[REDACTED_PHONE]'
  );

  // Mask emails
  sanitized = sanitized.replace(
    /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
    '[REDACTED_EMAIL]'
  );

  // Mask street addresses (e.g. 1420 5th Ave, 742 Evergreen Terrace)
  sanitized = sanitized.replace(
    /\b\d{1,5}\s+[A-Za-z0-9\s.,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Way|Drive|Dr|Terrace|Ter|Court|Ct)\b/gi,
    '[REDACTED_ADDRESS]'
  );

  return sanitized;
}

/**
 * Strips dangerous DIY instructions and rejects hallucinated OEM part SKUs
 */
export function sanitizeModelOutput(
  outputText: string,
  allowedOemSkus: string[] = []
): SanitizedModelOutputResult {
  let text = outputText || '';
  let stripped = false;
  const flaggedPhrases: string[] = [];
  const rejectedSkus: string[] = [];

  // 1. Strip dangerous DIY instructions
  for (const rule of DANGEROUS_DIY_PATTERNS) {
    if (rule.pattern.test(text)) {
      flaggedPhrases.push(rule.phrase);
      text = text.replace(rule.pattern, rule.replacement);
      stripped = true;
    }
  }

  if (stripped) {
    text += ' For your safety, do not attempt to service high-voltage electrical or pressurized gas components.';
  }

  // 2. Scan for SKU-like tokens (e.g. BOSCH-..., RHEEM-..., CARRIER-..., WHIRL-...)
  const skuPattern = /\b([A-Z0-9]{3,}-[A-Z0-9-]{3,})\b/g;
  const matches = text.match(skuPattern) || [];

  for (const match of matches) {
    if (allowedOemSkus.length > 0 && !allowedOemSkus.includes(match)) {
      rejectedSkus.push(match);
      // Replace hallucinated SKU with verified SKU or generic term
      const replacement = allowedOemSkus[0] || 'VERIFIED-OEM-PART';
      text = text.replace(match, replacement);
    }
  }

  return {
    sanitizedText: text,
    safeNarrative: text,
    strippedDangerousPhrases: stripped,
    hasDangerousInstructions: stripped,
    flaggedPhrases,
    rejectedHallucinatedSkus: rejectedSkus,
    hallucinatedSkus: rejectedSkus,
    hasHallucinatedSku: rejectedSkus.length > 0,
  };
}
