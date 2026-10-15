import { DynamoDBClient, DescribeTableCommand, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

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
  const client = getClient();
  if (!client) return;

  const tableName = process.env.DYNAMODB_TABLE_NAME || 'FirstFixMcpState';
  const serialized = JSON.stringify(data);
  const nowIso = new Date().toISOString();

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
