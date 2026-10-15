/**
 * FirstFix MCP Apps (profile=mcp-app) HTML/CSS/JS UI Templates
 * Standards-compliant with MCP Specification 2025-11-25 & JSON-RPC 2.0 postMessage Bridge
 */

export interface TemplateParams {
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  errorCode?: string;
  ocrConfidence?: number;
  requiresHumanConfirmation?: boolean;
  confirmationPrompt?: string;
  oemPartSku?: string;
  partName?: string;
  oemPartCostUsd?: number;
  whySerialVariantMatters?: string;
  correlationToken?: string;
  hazardType?: string;
  shutoffInstructions?: string;
  recommendedAction?: string;
  selectedSlotId?: string;
  vanId?: string;
  technicianName?: string;
  diagnosticFeeUsd?: number;
}

/**
 * 1. ui://firstfix/diagnostic-intake.html
 * Multimodal Rating-Plate Scanner, Serial-Variant Disambiguator & <0.90 OCR Human Gate
 */
export function renderDiagnosticIntakeHtml(params: TemplateParams = {}): string {
  const brand = params.brand || 'Bosch';
  const model = params.modelNumber || 'SHPM65Z55N/01';
  const serial = params.serialNumber || 'FD980112233';
  const error = params.errorCode || 'E24';
  const confidence = typeof params.ocrConfidence === 'number' ? params.ocrConfidence : 0.82;
  const isLowConfidence = confidence < 0.90 || params.requiresHumanConfirmation === true;
  const confidencePct = Math.round(confidence * 100);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FirstFix Diagnostic Intake</title>
  <style>
    :root {
      --bg: #0B0F19;
      --card-bg: #111827;
      --card-border: #1F2937;
      --cyan: #00CAFF;
      --text: #F9FAFB;
      --text-muted: #9CA3AF;
      --amber: #F59E0B;
      --green: #10B981;
      --red: #EF4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 18px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 16px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 17px;
      color: var(--cyan);
      letter-spacing: 0.5px;
    }
    .badge-alexa {
      background: rgba(0, 202, 255, 0.12);
      border: 1px solid var(--cyan);
      color: var(--cyan);
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 680px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px;
    }
    .plate-viewfinder {
      position: relative;
      background: #1e293b;
      border: 2px dashed rgba(0, 202, 255, 0.4);
      border-radius: 8px;
      height: 160px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 12px;
      overflow: hidden;
    }
    .laser-scanner {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--cyan), transparent);
      box-shadow: 0 0 12px var(--cyan);
      animation: scan 2.4s ease-in-out infinite alternate;
    }
    @keyframes scan {
      0% { top: 5%; }
      100% { top: 95%; }
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 13px;
    }
    .meta-label { color: var(--text-muted); }
    .meta-val { font-weight: 600; color: var(--text); }
    .confidence-meter {
      margin-top: 10px;
      background: #1f2937;
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
    }
    .confidence-fill {
      height: 100%;
      border-radius: 999px;
      background: ${isLowConfidence ? 'var(--amber)' : 'var(--green)'};
      width: ${confidencePct}%;
      transition: width 0.6s ease;
    }
    .alert-gate {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid var(--amber);
      border-radius: 8px;
      padding: 12px;
      margin-top: 14px;
      display: ${isLowConfidence ? 'block' : 'none'};
    }
    .alert-gate-title {
      color: var(--amber);
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn {
      background: var(--cyan);
      color: #04101E;
      font-weight: 700;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn:hover {
      background: #38d6ff;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: transparent;
      border: 1px solid var(--card-border);
      color: var(--text);
    }
    .btn-outline:hover {
      border-color: var(--cyan);
      color: var(--cyan);
    }
    .diy-checklist {
      margin-top: 14px;
      padding: 12px;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <span>FirstFix</span>
      <span style="color:var(--text-muted); font-size:14px; font-weight:400;">| Multimodal Plate Perception</span>
    </div>
    <span class="badge-alexa">Echo Show 15 MCP App</span>
  </div>

  <div class="grid">
    <div class="card">
      <h3 style="font-size:14px; color:var(--text-muted); margin-bottom:10px; text-transform:uppercase;">Visual Perception Engine</h3>
      <div class="plate-viewfinder">
        <div class="laser-scanner"></div>
        <div style="font-size:32px; margin-bottom:6px;">📸</div>
        <div style="font-weight:700; font-size:15px; color:#fff;" id="plate-brand-model">${brand} ${model}</div>
        <div style="font-size:12px; color:var(--text-muted);" id="plate-serial">Serial: ${serial} | Code: ${error}</div>
      </div>

      <div style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; font-size:12px;">
          <span style="color:var(--text-muted);">Vision Confidence Score</span>
          <span style="font-weight:700; color:${isLowConfidence ? 'var(--amber)' : 'var(--green)'};" id="confidence-text">${confidencePct}%</span>
        </div>
        <div class="confidence-meter">
          <div class="confidence-fill" id="confidence-bar"></div>
        </div>
      </div>

      <div class="alert-gate" id="alert-gate-box">
        <div class="alert-gate-title">
          <span>⚠️</span>
          <span>Human-in-the-Loop Confirmation Gate (&lt;90%)</span>
        </div>
        <p style="font-size:12px; color:#d1d5db; margin-bottom:10px;">
          The rating plate image has reflections or slight tilt (${confidencePct}% confidence). Please verify the serial number on screen before FirstFix reserves parts.
        </p>
        <button class="btn" id="btn-confirm-serial">
          ✓ Confirm Serial Number ${serial}
        </button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:14px; color:var(--text-muted); margin-bottom:10px; text-transform:uppercase;">Deterministic Machine Specs</h3>
      <div class="meta-row"><span class="meta-label">Equipment Brand</span><span class="meta-val" id="spec-brand">${brand}</span></div>
      <div class="meta-row"><span class="meta-label">Model Designation</span><span class="meta-val" id="spec-model">${model}</span></div>
      <div class="meta-row"><span class="meta-label">Serial Number</span><span class="meta-val" id="spec-serial">${serial}</span></div>
      <div class="meta-row"><span class="meta-label">Active Error Code</span><span class="meta-val" style="color:#f87171;" id="spec-error">${error}</span></div>
      <div class="meta-row"><span class="meta-label">Deterministic BOM Rule</span><span class="meta-val" id="spec-rule">Serial-Range Gate Active</span></div>

      <div class="diy-checklist">
        <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
          <input type="checkbox" id="chk-diy-precheck" style="margin-top:3px;">
          <div>
            <strong>Zero-Tool 90-Second DIY Pre-Check:</strong>
            <p style="color:#d1d5db; font-size:12px; margin-top:2px;">
              Inspect and snap shut the white sump pump cover at the bottom of the tub filter well. Loose sump covers trigger cavitation and false E24 errors without hardware failure.
            </p>
          </div>
        </label>
      </div>

      <div style="margin-top:16px; display:flex; gap:10px;">
        <button class="btn btn-outline" id="btn-rescan" style="flex:1;">🔄 Rescan Image</button>
        <button class="btn" id="btn-proceed" style="flex:1;">View Stocked Vans ➔</button>
      </div>
    </div>
  </div>

  <script>
    // JSON-RPC 2.0 postMessage Bridge with Parent Alexa+ Echo Show 15 Host
    window.addEventListener('load', () => {
      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'ui/initialize',
        params: {
          appUri: 'ui://firstfix/diagnostic-intake.html',
          version: '1.0.0',
          capabilities: ['tools/call', 'ui/message']
        }
      }, '*');
    });

    // Listen for host context updates
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;
      if (data.method === 'ui/update-context') {
        const p = data.params || {};
        if (p.serialNumber) document.getElementById('spec-serial').textContent = p.serialNumber;
        if (p.ocrConfidence !== undefined) {
          const pct = Math.round(p.ocrConfidence * 100);
          document.getElementById('confidence-text').textContent = pct + '%';
          document.getElementById('confidence-bar').style.width = pct + '%';
        }
      }
    });

    // Confirmation Button sends verified serial event to Host
    document.getElementById('btn-confirm-serial')?.addEventListener('click', () => {
      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'ui/message',
        params: {
          role: 'user',
          content: [{
            type: 'text',
            text: JSON.stringify({
              action: 'confirm_serial',
              brand: '${brand}',
              modelNumber: '${model}',
              serialNumber: '${serial}',
              errorCode: '${error}',
              userConfirmedSerial: true
            })
          }]
        }
      }, '*');
      document.getElementById('alert-gate-box').style.display = 'none';
    });

    // Proceed to Stocked Pro Carousel
    document.getElementById('btn-proceed')?.addEventListener('click', () => {
      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_stocked_van_availability',
          arguments: {
            oemPartSku: 'BOSCH-00631200',
            zipCode: '98101',
            preferredDateIso: '2026-10-15'
          }
        }
      }, '*');
    });
  </script>
</body>
</html>`;
}

/**
 * 2. ui://firstfix/stocked-pro-carousel.html
 * Stocked Contractor Van Carousel, Serial-Variant BOM Proof & 1-Tap UCP Checkout Trigger
 */
export function renderStockedProCarouselHtml(params: TemplateParams = {}): string {
  const oemPartSku = params.oemPartSku || 'BOSCH-00631200';
  const partName = params.partName || 'Bosch 3-Prong BLDC Drain Pump Assembly';
  const correlationToken = params.correlationToken || 'ff_booking_corr_sample_token';
  const diagnosticFee = params.diagnosticFeeUsd || 85.0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FirstFix Stocked Contractor Van Carousel</title>
  <style>
    :root {
      --bg: #0B0F19;
      --card-bg: #111827;
      --card-border: #1F2937;
      --cyan: #00CAFF;
      --text: #F9FAFB;
      --text-muted: #9CA3AF;
      --amber: #F59E0B;
      --green: #10B981;
      --red: #EF4444;
      --amazon-pay: #FF9900;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 16px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 14px;
    }
    .bom-proof-banner {
      background: linear-gradient(90deg, rgba(0, 202, 255, 0.12), rgba(16, 185, 129, 0.12));
      border: 1px solid rgba(0, 202, 255, 0.4);
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .van-carousel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .van-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px;
      position: relative;
      transition: all 0.2s;
    }
    .van-card.recommended {
      border-color: var(--cyan);
      box-shadow: 0 0 16px rgba(0, 202, 255, 0.15);
    }
    .van-card.excluded {
      opacity: 0.6;
      border-style: dashed;
      border-color: var(--card-border);
      background: #0d121d;
    }
    .van-badge {
      position: absolute;
      top: 14px;
      right: 14px;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      text-transform: uppercase;
    }
    .badge-stocked { background: rgba(16, 185, 129, 0.2); color: var(--green); border: 1px solid var(--green); }
    .badge-unstocked { background: rgba(239, 68, 68, 0.2); color: var(--red); border: 1px solid var(--red); }
    .tech-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .tech-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border: 2px solid var(--cyan);
    }
    .btn-pay {
      background: var(--amazon-pay);
      color: #111;
      font-weight: 800;
      border: none;
      border-radius: 8px;
      padding: 12px 18px;
      width: 100%;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      transition: all 0.2s;
    }
    .btn-pay:hover {
      background: #ffaa1a;
      transform: translateY(-1px);
    }
    .roi-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      color: var(--green);
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-weight:700; font-size:16px; color:var(--cyan);">
      FirstFix | Verified Stocked Contractor Network
    </div>
    <div class="roi-pill">
      <span>🛡️ $165 Second Truck Roll Saved</span>
    </div>
  </div>

  <div class="bom-proof-banner">
    <div>
      <div style="font-size:11px; text-transform:uppercase; color:var(--cyan); font-weight:700;">Exact Serial-Variant OEM Part Locked</div>
      <div style="font-size:15px; font-weight:700; color:#fff;" id="locked-oem-part">${oemPartSku}</div>
      <div style="font-size:12px; color:var(--text-muted);">${partName}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px; color:var(--text-muted);">First-Time Fix Guarantee</div>
      <div style="font-size:15px; font-weight:700; color:var(--green);">96% (vs 63% baseline)</div>
    </div>
  </div>

  <div class="van-carousel">
    <!-- Card 1: Apex Home Services (Van 4) - Stocked -->
    <div class="van-card recommended" id="card-van-apex">
      <span class="van-badge badge-stocked">2 Units on Truck</span>
      <div class="tech-header">
        <div class="tech-avatar">👨‍🔧</div>
        <div>
          <div style="font-weight:700; font-size:15px;">Marcus Vance</div>
          <div style="font-size:12px; color:var(--text-muted);">Apex Home Services (Van #4) • 4.9★ (382 reviews)</div>
        </div>
      </div>
      <div style="font-size:13px; margin: 8px 0; color:#d1d5db;">
        <div><strong>Today's Slot:</strong> 14:00 – 15:30 (Today, Oct 15)</div>
        <div><strong>Binding Estimate:</strong> $185 – $215 total repair</div>
        <div style="color:var(--cyan); font-size:12px;">★ $${diagnosticFee.toFixed(2)} deposit 100% credited to repair</div>
      </div>
      <button class="btn-pay" id="btn-book-apex">
        <span>⚡ Lock Part & Pay $${diagnosticFee.toFixed(2)} (Amazon Pay UCP)</span>
      </button>
    </div>

    <!-- Card 2: Precision Trade Pros (Van 1) - Stocked -->
    <div class="van-card" id="card-van-precision">
      <span class="van-badge badge-stocked">1 Unit on Truck</span>
      <div class="tech-header">
        <div class="tech-avatar">👩‍🔧</div>
        <div>
          <div style="font-weight:700; font-size:15px;">Elena Rostova</div>
          <div style="font-size:12px; color:var(--text-muted);">Precision Trade Pros (Van #1) • 4.8★ (210 reviews)</div>
        </div>
      </div>
      <div style="font-size:13px; margin: 8px 0; color:#d1d5db;">
        <div><strong>Today's Slot:</strong> 15:30 – 17:00 (Today, Oct 15)</div>
        <div><strong>Binding Estimate:</strong> $195 – $225 total repair</div>
        <div style="color:var(--cyan); font-size:12px;">★ $79.00 deposit 100% credited to repair</div>
      </div>
      <button class="btn-pay" style="background:#4b5563; color:#fff;" id="btn-book-precision">
        <span>Lock Part & Pay $79.00 Deposit</span>
      </button>
    </div>

    <!-- Card 3: Metro Rapid Appliance (Van 2) - EXCLUDED -->
    <div class="van-card excluded" id="card-van-metro">
      <span class="van-badge badge-unstocked">Missing Part (0 on Truck)</span>
      <div class="tech-header">
        <div class="tech-avatar" style="border-color:#6b7280;">⚠️</div>
        <div>
          <div style="font-weight:700; font-size:15px; color:#9ca3af;">Metro Rapid Appliance (Van #2)</div>
          <div style="font-size:12px; color:#6b7280;">Filtered Out to Prevent 2nd Truck Roll</div>
        </div>
      </div>
      <p style="font-size:12px; color:#6b7280; margin-top:8px;">
        This technician has legacy pump BOSCH-00611332 but lacks the required BLDC part BOSCH-00631200. Dispatching would cause a failed first visit.
      </p>
    </div>
  </div>

  <script>
    // Handshake on mount
    window.addEventListener('load', () => {
      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'ui/initialize',
        params: {
          appUri: 'ui://firstfix/stocked-pro-carousel.html',
          version: '1.0.0',
          capabilities: ['ui/message', 'tools/call']
        }
      }, '*');
    });

    // 1-Tap UCP Checkout Event Trigger via JSON-RPC 2.0 postMessage Bridge
    function triggerCheckout(slotId, vanId, techName, fee) {
      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'ui/message',
        params: {
          role: 'user',
          content: [{
            type: 'text',
            text: JSON.stringify({
              action: 'initiate_checkout',
              providerId: 'firstfix-home-services',
              selectedSlotId: slotId,
              vanId: vanId,
              technicianName: techName,
              oemPartSku: '${oemPartSku}',
              correlationToken: '${correlationToken}',
              diagnosticFeeUsd: fee,
              bindingEstimateMinUsd: 185.00,
              bindingEstimateMaxUsd: 215.00,
              diagnosticCreditPercentage: 100
            })
          }]
        }
      }, '*');
    }

    document.getElementById('btn-book-apex')?.addEventListener('click', () => {
      triggerCheckout('slot_apex_1400', 'van_apex_04', 'Marcus Vance', ${diagnosticFee});
    });

    document.getElementById('btn-book-precision')?.addEventListener('click', () => {
      triggerCheckout('slot_precision_1530', 'van_precision_01', 'Elena Rostova', 79.00);
    });
  </script>
</body>
</html>`;
}

/**
 * 3. ui://firstfix/emergency-shutoff.html
 * Critical Life-Safety Emergency Shutoff & Evacuation Overlay
 */
export function renderEmergencyShutoffHtml(params: TemplateParams = {}): string {
  const hazardType = params.hazardType || 'GAS_LEAK';
  const shutoff =
    params.shutoffInstructions ||
    'IMMEDIATELY EVACUATE the home. Do NOT flip light switches, do NOT operate doorbells, and do NOT use phones inside. If accessible from outside, shut off the main gas valve at your gas meter by turning the valve perpendicular to the pipe. Call your local gas utility and 911 from a safe distance.';
  const evacuation = params.recommendedAction || 'Evacuate all family members and pets immediately.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRITICAL EMERGENCY SHUTOFF PROTOCOL</title>
  <style>
    :root {
      --bg: #1A0A0A;
      --card-bg: #260D0D;
      --red: #EF4444;
      --red-glow: rgba(239, 68, 68, 0.4);
      --amber: #F59E0B;
      --text: #FEE2E2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 18px;
      line-height: 1.5;
    }
    .banner {
      background: var(--red);
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 0 20px var(--red-glow);
      animation: pulse 1.6s infinite alternate;
    }
    @keyframes pulse {
      0% { opacity: 0.9; }
      100% { opacity: 1.0; box-shadow: 0 0 30px rgba(239,68,68,0.7); }
    }
    .card {
      background: var(--card-bg);
      border: 2px solid var(--red);
      border-radius: 12px;
      padding: 20px;
      margin-top: 16px;
    }
    .step-item {
      display: flex;
      gap: 12px;
      margin: 14px 0;
      align-items: flex-start;
    }
    .step-num {
      background: var(--red);
      color: #fff;
      font-weight: 800;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
    }
    .valve-diagram {
      background: #000;
      border: 1px solid var(--red);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      margin: 16px 0;
      font-family: monospace;
      color: #fca5a5;
    }
    .btn-emergency {
      background: var(--red);
      color: #fff;
      font-weight: 800;
      border: none;
      border-radius: 8px;
      padding: 14px 20px;
      cursor: pointer;
      font-size: 15px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }
    .btn-emergency:hover { background: #dc2626; }
  </style>
</head>
<body>
  <div class="banner">
    <span style="font-size:24px;">🚨</span>
    <div>
      <div style="font-size:16px;">CRITICAL LIFE-SAFETY HAZARD DETECTED: ${hazardType}</div>
      <div style="font-size:11px; font-weight:500; text-transform:none;">Automated Contractor Booking Halted to Protect Homeowners</div>
    </div>
  </div>

  <div class="card">
    <h2 style="font-size:18px; color:#fff; margin-bottom:8px;">Mandatory Emergency Protocol</h2>
    <p style="color:#fca5a5; font-size:14px; margin-bottom:14px;">${evacuation}</p>

    <div class="step-item">
      <div class="step-num">1</div>
      <div>
        <strong>Immediate Evacuation:</strong>
        <p style="color:#fecaca; font-size:13px;">Move all occupants and pets outside into fresh air immediately. Do not use electrical switches or phones inside.</p>
      </div>
    </div>

    <div class="step-item">
      <div class="step-num">2</div>
      <div>
        <strong>Utility Shutoff Guidance:</strong>
        <p style="color:#fecaca; font-size:13px;">${shutoff}</p>
      </div>
    </div>

    <div class="valve-diagram">
      [ PIPE ] ======= [ QUARTER-TURN VALVE ] ======= [ GAS METER ]<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;▲<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TURN HANDLE PERPENDICULAR (90°) TO PIPE TO SHUT OFF
    </div>

    <div style="display:flex; gap:12px; margin-top:18px; flex-wrap:wrap;">
      <a href="tel:911" class="btn-emergency">📞 Call 911 Emergency Services</a>
      <button class="btn-emergency" style="background:#7f1d1d;" id="btn-sound-alert">🔊 Toggle Alert Tone</button>
    </div>
  </div>

  <script>
    // Handshake with parent
    window.addEventListener('load', () => {
      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'ui/initialize',
        params: {
          appUri: 'ui://firstfix/emergency-shutoff.html',
          hazardType: '${hazardType}',
          emergencyBlocked: true
        }
      }, '*');
    });

    // Web Audio Warning Tone Generator
    let audioCtx = null;
    let osc = null;
    document.getElementById('btn-sound-alert')?.addEventListener('click', () => {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        document.getElementById('btn-sound-alert').textContent = '⏹ Mute Alert Tone';
      } else {
        audioCtx.close();
        audioCtx = null;
        osc = null;
        document.getElementById('btn-sound-alert').textContent = '🔊 Toggle Alert Tone';
      }
    });
  </script>
</body>
</html>`;
}
