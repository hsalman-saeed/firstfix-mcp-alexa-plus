import fs from 'node:fs';
import path from 'node:path';
import { HouseholdEquipmentRecord } from '../types/index.js';
import { InitialHouseholdEquipment } from '../data/seedData.js';

export interface StorageOptions {
  storageMode?: 'local_or_dynamodb' | 'local' | 'dynamodb';
  localFilePath?: string;
  tablePrefix?: string;
}

export class FirstFixStorageAdapter {
  private mode: string;
  private localFilePath: string;
  private memoryStore: Map<string, HouseholdEquipmentRecord[]> = new Map();

  constructor(options: StorageOptions = {}) {
    this.mode = options.storageMode || process.env.STORAGE_MODE || 'local_or_dynamodb';
    this.localFilePath =
      options.localFilePath ||
      path.resolve(process.cwd(), 'data', 'local-household-registry.json');
    this.initialize();
  }

  private initialize(): void {
    // Populate in-memory store from seed data
    const grouped = new Map<string, HouseholdEquipmentRecord[]>();
    for (const item of InitialHouseholdEquipment) {
      const list = grouped.get(item.householdId) || [];
      list.push({ ...item });
      grouped.set(item.householdId, list);
    }
    this.memoryStore = grouped;

    // In local file mode, load if file exists; otherwise write initial seed
    try {
      if (fs.existsSync(this.localFilePath)) {
        const raw = fs.readFileSync(this.localFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as HouseholdEquipmentRecord[];
        const loadedGrouped = new Map<string, HouseholdEquipmentRecord[]>();
        for (const item of parsed) {
          const list = loadedGrouped.get(item.householdId) || [];
          list.push(item);
          loadedGrouped.set(item.householdId, list);
        }
        this.memoryStore = loadedGrouped;
      } else {
        this.persistLocalFile();
      }
    } catch {
      // Fallback silently to memory store if filesystem access fails
    }
  }

  private persistLocalFile(): void {
    try {
      const dir = path.dirname(this.localFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const allRecords: HouseholdEquipmentRecord[] = [];
      for (const records of this.memoryStore.values()) {
        allRecords.push(...records);
      }
      fs.writeFileSync(this.localFilePath, JSON.stringify(allRecords, null, 2), 'utf-8');
    } catch {
      // Memory store still valid
    }
  }

  public async getHouseholdEquipment(householdId: string): Promise<HouseholdEquipmentRecord[]> {
    const records = this.memoryStore.get(householdId) || [];
    return records.map((r) => ({ ...r }));
  }

  public async getEquipmentById(
    householdId: string,
    equipmentId: string
  ): Promise<HouseholdEquipmentRecord | null> {
    const list = this.memoryStore.get(householdId) || [];
    const item = list.find((e) => e.equipmentId === equipmentId);
    return item ? { ...item } : null;
  }

  public async saveEquipmentRecord(record: HouseholdEquipmentRecord): Promise<HouseholdEquipmentRecord> {
    const list = this.memoryStore.get(record.householdId) || [];
    const existingIndex = list.findIndex((e) => e.equipmentId === record.equipmentId);
    const updatedRecord: HouseholdEquipmentRecord = {
      ...record,
      updatedAtIso: record.updatedAtIso || new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = updatedRecord;
    } else {
      list.push(updatedRecord);
    }

    this.memoryStore.set(record.householdId, list);
    this.persistLocalFile();
    return { ...updatedRecord };
  }

  public async updateEquipmentServiceDate(
    householdId: string,
    equipmentId: string,
    serviceDateIso: string,
    serviceNotes?: string
  ): Promise<HouseholdEquipmentRecord | null> {
    const list = this.memoryStore.get(householdId) || [];
    const existing = list.find((e) => e.equipmentId === equipmentId);
    if (!existing) return null;

    existing.lastServiceDateIso = serviceDateIso;
    if (serviceNotes) {
      existing.notes = existing.notes
        ? `${existing.notes} | ${serviceNotes}`
        : serviceNotes;
    }
    existing.updatedAtIso = new Date().toISOString();
    this.persistLocalFile();
    return { ...existing };
  }

  public resetToSeed(): void {
    const grouped = new Map<string, HouseholdEquipmentRecord[]>();
    for (const item of InitialHouseholdEquipment) {
      const list = grouped.get(item.householdId) || [];
      list.push({ ...item });
      grouped.set(item.householdId, list);
    }
    this.memoryStore = grouped;
    this.persistLocalFile();
  }

  public getStorageMode(): string {
    return this.mode;
  }
}

export const defaultStorage = new FirstFixStorageAdapter();
