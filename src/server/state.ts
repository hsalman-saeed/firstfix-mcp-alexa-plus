import crypto from 'node:crypto';
import { ContractorVan } from '../types/index.js';
import { ContractorVans } from '../data/seedData.js';

export interface AppointmentRecord {
  appointmentId: string;
  businessId: string;
  serviceId: string;
  vanId: string;
  technicianName: string;
  slotId?: string;
  startTimeIso: string;
  endTimeIso: string;
  oemPartSku: string;
  householdId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  };
  correlationToken: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  diagnosticFeeUsd: number;
  bindingEstimateMinUsd: number;
  bindingEstimateMaxUsd: number;
  partHeld: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface UcpLineItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  type: 'diagnostic_fee_deposit' | 'estimated_repair_balance' | 'oem_part';
  credited_to_repair: boolean;
}

export interface UcpTotal {
  type: 'subtotal' | 'deposit_due_now' | 'estimated_balance_on_completion' | 'tax' | 'total';
  amount: number;
  currency: 'USD';
  description?: string;
}

export interface UcpCheckoutSession {
  id: string;
  status: 'incomplete' | 'ready_for_complete' | 'completed' | 'cancelled';
  currency: 'USD';
  correlationToken: string;
  appointmentId: string;
  line_items: UcpLineItem[];
  totals: UcpTotal[];
  fulfillment?: {
    type: 'technician_dispatch';
    address?: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  payment_handler?: {
    type: string;
    token?: string;
    status: 'AUTHORIZED' | 'CAPTURED' | 'PENDING';
  };
  ucp: {
    payment_handlers: string[];
  };
  links: Array<{ rel: string; href: string }> & {
    self: string;
    complete?: string;
    cancel?: string;
  };
  messages: Array<{ code: string; message: string; severity: 'info' | 'warning' | 'error' }>;
  metadata?: Record<string, any>;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface IdempotencyRecord {
  key: string;
  bodyHash: string;
  statusCode: number;
  responseBody: any;
  createdAt: number;
}

export interface RingAccessWindow {
  windowId: string;
  appointmentId: string;
  correlationToken: string;
  vanId: string;
  technicianName: string;
  cameraDeviceId: string;
  windowStartIso: string;
  windowEndIso: string;
  armed: boolean;
  securityPolicy: 'MONITORED_SINGLE_ENTRY';
  status: 'SCHEDULED' | 'ARRIVED' | 'EXPIRED' | 'REVOKED';
  createdAtIso: string;
}

export interface RingArrivalLog {
  eventId: string;
  windowId: string;
  appointmentId: string;
  correlationToken: string;
  technicianName: string;
  cameraDeviceId: string;
  eventTimeIso: string;
  accessGranted: boolean;
  reason: string;
}

export interface TelemetryMetrics {
  totalMcpCalls: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  preventedTruckRollsCount: number;
  totalDollarsSavedUsd: number;
  activeAppointments: number;
  ringAccessEvents: number;
}

export class FirstFixStateManager {
  public vans: ContractorVan[] = [];
  public appointments: Map<string, AppointmentRecord> = new Map();
  public ucpSessions: Map<string, UcpCheckoutSession> = new Map();
  public idempotencyCache: Map<string, IdempotencyRecord> = new Map();
  public ringAccessWindows: Map<string, RingAccessWindow> = new Map();
  public ringAuditLogs: RingArrivalLog[] = [];
  private activePartHolds = new Set<string>();

  // Telemetry metrics
  public totalMcpCalls = 0;
  public totalLatencyMs = 0;
  public preventedTruckRollsCount = 0;
  public totalDollarsSavedUsd = 0;
  public ringAccessEvents = 0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    // Deep clone contractor vans so stock decrements can be isolated/tested
    this.vans = JSON.parse(JSON.stringify(ContractorVans));
    this.appointments.clear();
    this.ucpSessions.clear();
    this.idempotencyCache.clear();
    this.ringAccessWindows.clear();
    const sampleWindowId = 'ring_win_seed_sample';
    this.ringAccessWindows.set(sampleWindowId, {
      windowId: sampleWindowId,
      appointmentId: 'apt_seed_marcus_vance',
      correlationToken: 'ff_booking_corr_sample_token',
      technicianName: 'Marcus Vance',
      vanId: 'van_apex_04',
      cameraDeviceId: 'ring_front_door_cam_01',
      windowStartIso: '2026-10-15T14:00:00Z',
      windowEndIso: '2026-10-15T15:30:00Z',
      armed: true,
      securityPolicy: 'MONITORED_SINGLE_ENTRY',
      status: 'SCHEDULED',
      createdAtIso: new Date().toISOString(),
    });
    this.ringAuditLogs = [];
    this.activePartHolds.clear();
    this.totalMcpCalls = 0;
    this.totalLatencyMs = 0;
    this.preventedTruckRollsCount = 0;
    this.totalDollarsSavedUsd = 0;
    this.ringAccessEvents = 0;
  }

  public resetAppState(): void {
    this.reset();
  }

  public getVans(): ContractorVan[] {
    return this.vans;
  }

  public recordMcpCall(latencyMs: number, preventedTruckRoll = false): void {
    this.totalMcpCalls++;
    this.totalLatencyMs += latencyMs;
    if (preventedTruckRoll) {
      this.preventedTruckRollsCount++;
      this.totalDollarsSavedUsd += 165.0;
    }
  }

  public getTelemetry(): TelemetryMetrics {
    const avg = this.totalMcpCalls > 0 ? Math.round(this.totalLatencyMs / this.totalMcpCalls) : 0;
    const activeAppts = Array.from(this.appointments.values()).filter(
      (a) => a.status === 'CONFIRMED' || a.status === 'PENDING_PAYMENT'
    ).length;

    return {
      totalMcpCalls: this.totalMcpCalls,
      totalLatencyMs: this.totalLatencyMs,
      averageLatencyMs: avg,
      preventedTruckRollsCount: this.preventedTruckRollsCount,
      totalDollarsSavedUsd: this.totalDollarsSavedUsd,
      activeAppointments: activeAppts,
      ringAccessEvents: this.ringAccessEvents,
    };
  }

  // Idempotency helper
  public hashRequestBody(body: any): string {
    const str = typeof body === 'string' ? body : JSON.stringify(body || {});
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  public getIdempotent(key: string): IdempotencyRecord | null {
    const record = this.idempotencyCache.get(key);
    if (!record) return null;
    const now = Date.now();
    // 24 hours TTL: 24 * 60 * 60 * 1000 = 86,400,000 ms
    if (now - record.createdAt > 86400000) {
      this.idempotencyCache.delete(key);
      return null;
    }
    return record;
  }

  public setIdempotent(key: string, bodyHash: string, statusCode: number, responseBody: any): void {
    this.idempotencyCache.set(key, {
      key,
      bodyHash,
      statusCode,
      responseBody,
      createdAt: Date.now(),
    });
  }

  // Stock hold / decrement helper with correlationToken idempotency (Finding F-4)
  public holdPartOnVan(vanId: string, oemPartSku: string, correlationToken?: string): boolean {
    const normSku = oemPartSku.toUpperCase();
    if (correlationToken) {
      const holdKey = `${correlationToken}:${vanId}:${normSku}`;
      if (this.activePartHolds.has(holdKey)) {
        return true; // Already held for this correlation token; do not decrement a second time
      }
    }
    const van = this.vans.find((v) => v.vanId === vanId);
    if (!van) return false;
    const item = van.inventory.find((i) => i.oemPartSku.toUpperCase() === normSku);
    if (!item || item.quantity <= 0) return false;
    item.quantity -= 1;
    if (correlationToken) {
      this.activePartHolds.add(`${correlationToken}:${vanId}:${normSku}`);
    }
    return true;
  }

  public releasePartOnVan(vanId: string, oemPartSku: string, correlationToken?: string): void {
    const normSku = oemPartSku.toUpperCase();
    if (correlationToken) {
      const holdKey = `${correlationToken}:${vanId}:${normSku}`;
      this.activePartHolds.delete(holdKey);
    }
    const van = this.vans.find((v) => v.vanId === vanId);
    if (!van) return;
    const item = van.inventory.find((i) => i.oemPartSku.toUpperCase() === normSku);
    if (item) {
      item.quantity += 1;
    }
  }
}

export const appState = new FirstFixStateManager();

export function resetAppState(): void {
  appState.reset();
}
