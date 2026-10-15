import http from 'node:http';
import { AddressInfo } from 'node:net';
import { createApp } from '../server/app.js';
import { checkDynamoConnection } from './dynamoPersistence.js';

let localServer: http.Server | null = null;
let serverPort = 0;
let initPromise: Promise<void> | null = null;

async function ensureServerStarted(): Promise<number> {
  if (serverPort > 0) return serverPort;
  if (!initPromise) {
    initPromise = new Promise((resolve, reject) => {
      try {
        const app = createApp();
        localServer = app.listen(0, '127.0.0.1', () => {
          const address = localServer!.address() as AddressInfo;
          serverPort = address.port;
          localServer!.unref();
          // Non-blocking connection check to DynamoDB
          checkDynamoConnection().catch(() => {});
          resolve();
        });
        localServer.on('error', reject);
      } catch (err) {
        reject(err);
      }
    });
  }
  await initPromise;
  return serverPort;
}

export async function closeLambdaServer(): Promise<void> {
  if (localServer) {
    await new Promise<void>((resolve) => localServer!.close(() => resolve()));
    localServer = null;
    serverPort = 0;
    initPromise = null;
  }
}

export interface LambdaFunctionUrlEventV2 {
  version?: string;
  routeKey?: string;
  rawPath: string;
  rawQueryString?: string;
  headers: Record<string, string>;
  requestContext: {
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp?: string;
      userAgent?: string;
    };
    domainName?: string;
    timeEpoch?: number;
  };
  body?: string;
  isBase64Encoded?: boolean;
}

export interface LambdaFunctionUrlResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
}

/**
 * AWS Lambda Function URL Handler (APIGatewayProxyEventV2)
 * Bridges AWS Lambda Function URL directly into our Express application
 */
export async function handler(
  event: LambdaFunctionUrlEventV2,
  context?: any
): Promise<LambdaFunctionUrlResultV2> {
  const port = await ensureServerStarted();

  const method = event.requestContext?.http?.method || 'GET';
  const rawPath = event.rawPath || '/';
  const queryString = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const fullPath = `${rawPath}${queryString}`;

  const domainName = event.requestContext?.domainName || event.headers?.['host'] || 'localhost';
  const proto = 'https';

  // Construct request headers forwarding to internal Express instance
  const outboundHeaders: Record<string, string> = { ...event.headers };
  outboundHeaders['x-forwarded-proto'] = proto;
  outboundHeaders['x-forwarded-host'] = domainName;
  outboundHeaders['host'] = domainName;

  // Prepare body payload if present
  let requestBodyBuffer: Buffer | null = null;
  if (event.body) {
    if (event.isBase64Encoded) {
      requestBodyBuffer = Buffer.from(event.body, 'base64');
    } else {
      requestBodyBuffer = Buffer.from(event.body, 'utf-8');
    }
    outboundHeaders['content-length'] = String(requestBodyBuffer.length);
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: fullPath,
        method,
        headers: outboundHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const resBodyBuffer = Buffer.concat(chunks);
          const responseHeaders: Record<string, string> = {};

          for (const [key, value] of Object.entries(res.headers)) {
            if (value !== undefined) {
              responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
            }
          }

          const contentType = responseHeaders['content-type'] || '';
          const isBinary =
            contentType.startsWith('image/') ||
            contentType.includes('octet-stream') ||
            contentType.includes('pdf');

          resolve({
            statusCode: res.statusCode || 200,
            headers: responseHeaders,
            body: isBinary
              ? resBodyBuffer.toString('base64')
              : resBodyBuffer.toString('utf-8'),
            isBase64Encoded: isBinary,
          });
        });
      }
    );

    req.on('error', (err) => {
      console.error('[Lambda Bridge Error]', err);
      resolve({
        statusCode: 502,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Internal Lambda HTTP Bridge Error', details: err.message }),
      });
    });

    if (requestBodyBuffer) {
      req.write(requestBodyBuffer);
    }
    req.end();
  });
}
