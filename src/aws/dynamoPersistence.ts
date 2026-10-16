import {
  DynamoDBClient,
  DescribeTableCommand,
  PutItemCommand,
  ScanCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';

export interface DynamoRecordItem {
  pk: string;
  sk: string;
  payload: any;
  updatedAt: string;
}

export interface DynamoPersistenceStatus {
  status: 'connected_us_east_1' | 'in_memory_fallback';
  tableName: string;
  region: string;
  lastWriteIso?: string;
  lastError?: string;
}

let dynamoClient: DynamoDBClient | null = null;
let currentStatus: 'connected_us_east_1' | 'in_memory_fallback' = 'in_memory_fallback';
let lastWriteTimestamp: string | undefined;
let lastErrorMsg: string | undefined;

// In-memory shadow log for instantaneous query verification & fallback
const inMemoryPersistedRecords: Map<string, DynamoRecordItem> = new Map();

function getClient(): DynamoDBClient | null {
  if (dynamoClient) return dynamoClient;

  const hasCreds = Boolean(
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
  );

  if (!hasCreds) {
    currentStatus = 'in_memory_fallback';
    return null;
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  try {
    dynamoClient = new DynamoDBClient({ region });
    return dynamoClient;
  } catch (err: any) {
    lastErrorMsg = err?.message || String(err);
    currentStatus = 'in_memory_fallback';
    return null;
  }
}

export function getDynamoStatus(): DynamoPersistenceStatus {
  return {
    status: currentStatus,
    tableName: process.env.DYNAMODB_TABLE_NAME || 'FirstFixMcpState',
    region: process.env.AWS_REGION || 'us-east-1',
    lastWriteIso: lastWriteTimestamp,
    lastError: lastErrorMsg,
  };
}

export async function checkDynamoConnection(): Promise<boolean> {
  const client = getClient();
  if (!client) {
    currentStatus = 'in_memory_fallback';
    return false;
  }

  const tableName = process.env.DYNAMODB_TABLE_NAME || 'FirstFixMcpState';
  try {
    const res = await client.send(new DescribeTableCommand({ TableName: tableName }));
    if (res.Table?.TableStatus === 'ACTIVE') {
      currentStatus = 'connected_us_east_1';
      return true;
    }
    currentStatus = 'in_memory_fallback';
    return false;
  } catch (err: any) {
    lastErrorMsg = err?.message || String(err);
    currentStatus = 'in_memory_fallback';
    return false;
  }
}

/**
 * Non-blocking, write-through persistence helper for DynamoDB.
 * Writes execute asynchronously so in-memory state and MCP SLA (<500ms) are never delayed.
 */
export function persistRecordAsync(pk: string, sk: string, data: Record<string, any>): void {
  const nowIso = new Date().toISOString();
  inMemoryPersistedRecords.set(`${pk}#${sk}`, {
    pk,
    sk,
    payload: data,
    updatedAt: nowIso,
  });

  const client = getClient();
  if (!client) return;

  const tableName = process.env.DYNAMODB_TABLE_NAME || 'FirstFixMcpState';
  const serialized = JSON.stringify(data);

  client
    .send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          pk: { S: pk },
          sk: { S: sk },
          payload: { S: serialized },
          updatedAt: { S: nowIso },
        },
      })
    )
    .then(() => {
      currentStatus = 'connected_us_east_1';
      lastWriteTimestamp = nowIso;
    })
    .catch((err: any) => {
      lastErrorMsg = err?.message || String(err);
      // Fail open: log warning but never crash runtime
      console.warn(`[DynamoDB Async Write Warning] ${pk} / ${sk}:`, err?.message || err);
    });
}

/**
 * Gap G-5: Fetches recent DynamoDB records from FirstFixMcpState in us-east-1 (or in-memory cache)
 */
export async function fetchRecentDynamoRecords(limit = 20): Promise<{
  tableName: string;
  region: string;
  status: string;
  itemCount: number;
  items: DynamoRecordItem[];
}> {
  const tableName = process.env.DYNAMODB_TABLE_NAME || 'FirstFixMcpState';
  const region = process.env.AWS_REGION || 'us-east-1';
  const client = getClient();

  if (!client) {
    const items = Array.from(inMemoryPersistedRecords.values())
      .slice(-limit)
      .reverse();
    return {
      tableName,
      region,
      status: currentStatus,
      itemCount: items.length,
      items,
    };
  }

  try {
    const scanResult = await client.send(
      new ScanCommand({
        TableName: tableName,
        Limit: limit,
      })
    );

    const items: DynamoRecordItem[] = (scanResult.Items || []).map((raw) => {
      let parsedPayload: any = null;
      try {
        parsedPayload = raw.payload?.S ? JSON.parse(raw.payload.S) : raw.payload;
      } catch {
        parsedPayload = raw.payload?.S || null;
      }
      return {
        pk: raw.pk?.S || 'UNKNOWN',
        sk: raw.sk?.S || 'UNKNOWN',
        payload: parsedPayload,
        updatedAt: raw.updatedAt?.S || new Date().toISOString(),
      };
    });

    currentStatus = 'connected_us_east_1';
    return {
      tableName,
      region,
      status: 'connected_us_east_1',
      itemCount: items.length,
      items,
    };
  } catch (err: any) {
    lastErrorMsg = err?.message || String(err);
    const fallbackItems = Array.from(inMemoryPersistedRecords.values())
      .slice(-limit)
      .reverse();
    return {
      tableName,
      region,
      status: 'in_memory_fallback',
      itemCount: fallbackItems.length,
      items: fallbackItems,
    };
  }
}

/**
 * Gap G-5: Hydrates active state records from DynamoDB into memory
 */
export async function hydrateStateFromDynamoDB(state: any): Promise<number> {
  const records = await fetchRecentDynamoRecords(50);
  let hydratedCount = 0;

  for (const item of records.items) {
    if (item.pk.startsWith('APPOINTMENT#') && item.payload?.appointmentId) {
      state.appointments.set(item.payload.appointmentId, item.payload);
      hydratedCount++;
    } else if (item.pk.startsWith('UCP_SESSION#') && item.payload?.id) {
      state.ucpSessions.set(item.payload.id, item.payload);
      hydratedCount++;
    } else if (item.pk.startsWith('RING_WINDOW#') && item.payload?.windowId) {
      state.ringAccessWindows.set(item.payload.windowId, item.payload);
      hydratedCount++;
    } else if (item.pk.startsWith('RING_AUDIT#') && item.payload?.eventId) {
      if (!state.ringAuditLogs.some((l: any) => l.eventId === item.payload.eventId)) {
        state.ringAuditLogs.push(item.payload);
        hydratedCount++;
      }
    }
  }

  return hydratedCount;
}

/**
 * Gap G-5: Cleans demo session items in DynamoDB asynchronously
 */
export async function clearDemoRecordsInDynamoDB(): Promise<void> {
  inMemoryPersistedRecords.clear();
  const client = getClient();
  if (!client) return;

  const tableName = process.env.DYNAMODB_TABLE_NAME || 'FirstFixMcpState';
  try {
    const scan = await client.send(
      new ScanCommand({
        TableName: tableName,
        Limit: 50,
      })
    );

    const deletePromises = (scan.Items || [])
      .filter((i) => {
        const pk = i.pk?.S || '';
        return (
          pk.startsWith('APPOINTMENT#') ||
          pk.startsWith('UCP_SESSION#') ||
          pk.startsWith('RING_WINDOW#') ||
          pk.startsWith('RING_AUDIT#') ||
          pk.startsWith('FSM_WEBHOOK#')
        );
      })
      .map((i) =>
        client.send(
          new DeleteItemCommand({
            TableName: tableName,
            Key: {
              pk: i.pk!,
              sk: i.sk!,
            },
          })
        )
      );

    await Promise.allSettled(deletePromises);
  } catch (err) {
    console.warn('[DynamoDB Clear Demo Records Warning]:', err);
  }
}
