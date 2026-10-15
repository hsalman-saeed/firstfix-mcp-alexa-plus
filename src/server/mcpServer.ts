import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import {
  evaluateSafetyAndPrecheck,
  resolveSerialVariantBOM,
  matchStockedContractorSlots,
} from '../engine/firstFixEngine.js';
import { defaultStorage } from '../storage/storageAdapter.js';
import { appState, AppointmentRecord } from './state.js';

export function createFirstFixMcpServer(): McpServer {
  const server = new McpServer({
    name: 'firstfix-mcp-server',
    version: '1.0.0',
  });

  // 1. Register App Resource: Diagnostic Intake UI Scaffold
  registerAppResource(
    server,
    'firstfix-diagnostic-intake-ui',
    'ui://firstfix/diagnostic-intake.html',
    {},
    async (uri: any) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: RESOURCE_MIME_TYPE,
          text: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FirstFix Diagnostic Intake</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    h2 { color: #38bdf8; margin-top: 0; }
    .badge { background: #0369a1; color: #e0f2fe; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>FirstFix Multimodal Diagnostic Intake</h2>
      <span class="badge">Alexa+ MCP Streamable</span>
    </div>
    <p>Scan rating plate or provide machine serial number to trigger 100% deterministic OEM BOM matching and zero-tool 90-second safety pre-checks.</p>
  </div>
</body>
</html>`,
        },
      ],
    })
  );

  // 2. Register App Resource: Stocked-Pro Carousel UI Scaffold
  registerAppResource(
    server,
    'firstfix-stocked-pro-carousel-ui',
    'ui://firstfix/stocked-pro-carousel.html',
    {},
    async (uri: any) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: RESOURCE_MIME_TYPE,
          text: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FirstFix Stocked-Pro Carousel</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    h2 { color: #10b981; margin-top: 0; }
    .van-item { border-left: 4px solid #10b981; padding-left: 12px; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Verified Stocked Local Contractors</h2>
    <p>Only technicians with verified, physical truck-stock of your machine's exact OEM part are displayed below. Guaranteed no second truck rolls ($165 savings).</p>
  </div>
</body>
</html>`,
        },
      ],
    })
  );

  // --------------------------------------------------------------------------
  // Tool 1: diagnose_equipment_and_bom
  // --------------------------------------------------------------------------
  registerAppTool(
    server,
    'diagnose_equipment_and_bom',
    {
      description:
        'Analyzes machine symptoms and rating-plate serial data to resolve exact OEM replacement part SKU, 90s DIY pre-check, and factory warranty status.',
      inputSchema: {
        brand: z.string().describe('Brand name (e.g. Bosch, Rheem, Carrier)'),
        modelNumber: z.string().describe('Model number from rating plate'),
        serialNumber: z.string().describe('Serial number from rating plate'),
        errorCode: z.string().describe('Active machine error code (e.g. E24, 4_FLASHES)'),
        symptomText: z.string().optional().describe('Homeowner symptom description'),
        householdId: z.string().optional().describe('Household ID for persistent equipment registry'),
        installDateIso: z.string().optional().describe('Known installation date in ISO 8601 format'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://firstfix/diagnostic-intake.html',
        },
      },
    },
    async (args: any) => {
      const t0 = performance.now();

      // Step 1: Safety screening first
      const safetyResult = evaluateSafetyAndPrecheck({
        symptomText: args.symptomText || '',
        errorCode: args.errorCode,
      });

      if (safetyResult.emergencyBlocked) {
        const latencyMs = Math.round(performance.now() - t0);
        appState.recordMcpCall(latencyMs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'CRITICAL_EMERGENCY',
                  emergencyBlocked: true,
                  hazardType: safetyResult.hazardType,
                  shutoffInstructions: safetyResult.shutoffInstructions,
                  recommendedAction: safetyResult.recommendedAction,
                  executionLatencyMs: latencyMs,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Step 2: Deterministic BOM resolution
      const bomResult = resolveSerialVariantBOM({
        brand: args.brand,
        modelNumber: args.modelNumber,
        serialNumber: args.serialNumber,
        errorCode: args.errorCode,
        installDateIso: args.installDateIso,
      });

      // Step 3: Persist equipment to household registry if householdId provided
      if (args.householdId && bomResult.status === 'MATCHED') {
        await defaultStorage.saveEquipmentRecord({
          householdId: args.householdId,
          equipmentId: `eq_${args.brand.toLowerCase()}_${Date.now()}`,
          brand: args.brand,
          modelNumber: args.modelNumber,
          serialNumber: args.serialNumber,
          category: 'DISHWASHER',
          installDateIso: args.installDateIso || '2024-01-01T00:00:00Z',
          updatedAtIso: new Date().toISOString(),
          notes: `Diagnosed error ${args.errorCode} -> OEM part ${bomResult.oemPartSku}`,
        });
      }

      const latencyMs = Math.round(performance.now() - t0);
      appState.recordMcpCall(latencyMs);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...bomResult,
                safetyEvaluation: safetyResult,
                executionLatencyMs: latencyMs,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --------------------------------------------------------------------------
  // Tool 2: run_safety_and_diy_precheck
  // --------------------------------------------------------------------------
  registerAppTool(
    server,
    'run_safety_and_diy_precheck',
    {
      description:
        'Evaluates reported symptom text for critical hazards and provides zero-tool 90-second DIY pre-checks.',
      inputSchema: {
        symptomText: z.string().describe('Reported symptom text'),
        applianceCategory: z.string().optional().describe('Category of appliance'),
        errorCode: z.string().optional().describe('Appliance error code'),
      },
      _meta: {},
    },
    async (args: any) => {
      const t0 = performance.now();
      const result = evaluateSafetyAndPrecheck({
        symptomText: args.symptomText,
        applianceCategory: args.applianceCategory,
        errorCode: args.errorCode,
      });
      const latencyMs = Math.round(performance.now() - t0);
      appState.recordMcpCall(latencyMs);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...result,
                executionLatencyMs: latencyMs,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --------------------------------------------------------------------------
  // Tool 3: get_stocked_van_availability
  // --------------------------------------------------------------------------
  registerAppTool(
    server,
    'get_stocked_van_availability',
    {
      description:
        'Queries local contractor vans for physical stock of the resolved OEM part SKU, excluding unequipped vans to guarantee no second truck roll.',
      inputSchema: {
        oemPartSku: z.string().describe('Exact OEM part SKU (e.g. BOSCH-00631200)'),
        zipCode: z.string().describe('5-digit US postal code'),
        preferredDateIso: z.string().describe('Preferred appointment date (YYYY-MM-DD)'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://firstfix/stocked-pro-carousel.html',
        },
      },
    },
    async (args: any) => {
      const t0 = performance.now();
      const matchResult = matchStockedContractorSlots({
        oemPartSku: args.oemPartSku,
        zipCode: args.zipCode,
        preferredDateIso: args.preferredDateIso,
      });

      const latencyMs = Math.round(performance.now() - t0);
      appState.recordMcpCall(latencyMs, matchResult.unstockedSlotsCount > 0);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...matchResult,
                executionLatencyMs: latencyMs,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --------------------------------------------------------------------------
  // Tool 4: reserve_part_and_slot
  // --------------------------------------------------------------------------
  registerAppTool(
    server,
    'reserve_part_and_slot',
    {
      description:
        'Holds 1 unit of OEM part on the chosen contractor van and initiates pending appointment ready for Alexa+ UCP checkout.',
      inputSchema: {
        vanId: z.string().describe('ID of contractor van'),
        slotTimeIso: z.string().describe('Appointment start timestamp (ISO 8601)'),
        oemPartSku: z.string().describe('Resolved OEM part SKU'),
        householdId: z.string().optional().describe('Homeowner household identifier'),
        correlationToken: z.string().describe('Opaque correlation token from availability check'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://firstfix/stocked-pro-carousel.html',
        },
      },
    },
    async (args: any) => {
      const t0 = performance.now();

      const van = appState.vans.find((v) => v.vanId === args.vanId);
      if (!van) {
        throw new Error(`Contractor van '${args.vanId}' not found.`);
      }

      const held = appState.holdPartOnVan(args.vanId, args.oemPartSku);
      if (!held) {
        throw new Error(`Part '${args.oemPartSku}' is out of stock on van '${args.vanId}'.`);
      }

      const appointmentId = `appt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const endTime = new Date(new Date(args.slotTimeIso).getTime() + 90 * 60 * 1000).toISOString();

      const appointment: AppointmentRecord = {
        appointmentId,
        businessId: van.contractorId,
        serviceId: 'srv_oem_firstfix_repair',
        vanId: van.vanId,
        technicianName: van.technicianName,
        startTimeIso: args.slotTimeIso,
        endTimeIso: endTime,
        oemPartSku: args.oemPartSku,
        householdId: args.householdId,
        correlationToken: args.correlationToken,
        status: 'PENDING_PAYMENT',
        diagnosticFeeUsd: van.pricing.diagnosticFeeUsd,
        bindingEstimateMinUsd: van.pricing.bindingEstimateMinUsd,
        bindingEstimateMaxUsd: van.pricing.bindingEstimateMaxUsd,
        partHeld: true,
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      };

      appState.appointments.set(appointmentId, appointment);

      const latencyMs = Math.round(performance.now() - t0);
      appState.recordMcpCall(latencyMs);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                appointmentId,
                status: appointment.status,
                vanId: van.vanId,
                technicianName: van.technicianName,
                oemPartSku: args.oemPartSku,
                partHeld: true,
                diagnosticFeeUsd: van.pricing.diagnosticFeeUsd,
                diagnosticFeeCreditNote: '100% of diagnostic fee credited toward final repair labor',
                bindingEstimateRangeUsd: `$${van.pricing.bindingEstimateMinUsd.toFixed(2)} - $${van.pricing.bindingEstimateMaxUsd.toFixed(2)}`,
                correlationToken: args.correlationToken,
                nextStep: 'Initiate Alexa+ UCP checkout session with appointmentId',
                executionLatencyMs: latencyMs,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // --------------------------------------------------------------------------
  // Tool 5: sync_ring_technician_access
  // --------------------------------------------------------------------------
  registerAppTool(
    server,
    'sync_ring_technician_access',
    {
      description:
        'Schedules a verified Ring smart doorbell/lock access window for the technician arrival window.',
      inputSchema: {
        appointmentId: z.string().describe('Confirmed appointment ID'),
        correlationToken: z.string().describe('Booking correlation token'),
        vanId: z.string().describe('Contractor van ID'),
        technicianName: z.string().describe('Certified technician full name'),
        windowStartIso: z.string().describe('Window start timestamp (ISO 8601)'),
        windowEndIso: z.string().describe('Window end timestamp (ISO 8601)'),
        cameraDeviceId: z.string().optional().describe('Ring camera ID (default: ring_front_door_cam_01)'),
      },
      _meta: {},
    },
    async (args: any) => {
      const t0 = performance.now();
      const windowId = `ring_win_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const camera = args.cameraDeviceId || 'ring_front_door_cam_01';

      appState.ringAccessWindows.set(windowId, {
        windowId,
        appointmentId: args.appointmentId,
        correlationToken: args.correlationToken,
        vanId: args.vanId,
        technicianName: args.technicianName,
        cameraDeviceId: camera,
        windowStartIso: args.windowStartIso,
        windowEndIso: args.windowEndIso,
        armed: true,
        securityPolicy: 'MONITORED_SINGLE_ENTRY',
        status: 'SCHEDULED',
        createdAtIso: new Date().toISOString(),
      });

      const latencyMs = Math.round(performance.now() - t0);
      appState.recordMcpCall(latencyMs);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                windowId,
                appointmentId: args.appointmentId,
                correlationToken: args.correlationToken,
                armed: true,
                securityPolicy: 'MONITORED_SINGLE_ENTRY',
                cameraDeviceId: camera,
                technicianName: args.technicianName,
                status: 'SCHEDULED',
                instructions:
                  'Ring will match technician arrival badge & correlation token at front door camera to grant temporary monitored entry.',
                executionLatencyMs: latencyMs,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
