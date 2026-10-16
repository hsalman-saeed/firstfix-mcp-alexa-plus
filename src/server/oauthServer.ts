import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export interface OAuthAuthCodeRecord {
  code: string;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  redirectUri?: string;
  scope: string;
  expiresAt: number;
}

export interface OAuthTokenClaims {
  sub: string;
  client_id: string;
  scope: string;
  iat: number;
  exp: number;
  iss: string;
}

const HMAC_SECRET = process.env.OAUTH_JWT_SECRET || 'firstfix_oauth21_jwt_secret_us_east_1_2026';
const authCodeStore = new Map<string, OAuthAuthCodeRecord>();

export const oauthRouter = Router();

/**
 * Signs payload using HMAC-SHA256 with base64url encoding
 */
export function signOAuthToken(claims: OAuthTokenClaims): string {
  const payloadB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `ff_oauth21_${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes an OAuth 2.1 Bearer token
 */
export function verifyOAuthToken(token: string): OAuthTokenClaims | null {
  if (!token || !token.startsWith('ff_oauth21_')) {
    return null;
  }

  const raw = token.slice('ff_oauth21_'.length);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payloadB64)
    .digest('base64url');

  if (signature !== expectedSig) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as OAuthTokenClaims;
    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < nowSec) {
      return null; // Expired
    }
    return claims;
  } catch {
    return null;
  }
}

/**
 * GET /oauth/authorize
 * Accepts PKCE code_challenge with code_challenge_method=S256
 */
oauthRouter.get('/oauth/authorize', (req: Request, res: Response) => {
  const responseType = req.query.response_type as string;
  const clientId = (req.query.client_id as string) || 'firstfix_alexa_plus_client';
  const redirectUri = req.query.redirect_uri as string | undefined;
  const codeChallenge = req.query.code_challenge as string;
  const codeChallengeMethod = (req.query.code_challenge_method as string) || 'S256';
  const state = req.query.state as string | undefined;
  const scope = (req.query.scope as string) || 'mcp:tools ucp:checkout booking:spi ring:access';

  if (responseType !== 'code') {
    res.status(400).json({
      error: 'unsupported_response_type',
      error_description: "Response type must be 'code' for OAuth 2.1 authorization code flow.",
    });
    return;
  }

  if (!codeChallenge) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'PKCE code_challenge is required per OAuth 2.1 specification (RFC 7636).',
    });
    return;
  }

  if (codeChallengeMethod !== 'S256') {
    res.status(400).json({
      error: 'invalid_request',
      error_description: "code_challenge_method must be 'S256'. Plain text PKCE is prohibited in OAuth 2.1.",
    });
    return;
  }

  const code = `ff_code_${crypto.randomBytes(16).toString('hex')}`;
  authCodeStore.set(code, {
    code,
    clientId,
    codeChallenge,
    codeChallengeMethod: 'S256',
    redirectUri,
    scope,
    expiresAt: Date.now() + 600000, // 10 minutes
  });

  const wantsJson =
    req.headers['accept']?.includes('application/json') ||
    req.query.format === 'json' ||
    req.query.mode === 'json';

  if (wantsJson || !redirectUri) {
    res.status(200).json({
      code,
      state: state || null,
      expires_in: 600,
      token_type: 'Bearer',
      scope,
    });
    return;
  }

  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  if (state) {
    url.searchParams.set('state', state);
  }
  res.redirect(302, url.toString());
});

/**
 * POST /oauth/token
 * Supports grant_type=authorization_code (with PKCE S256 verification) and grant_type=client_credentials
 */
oauthRouter.post('/oauth/token', (req: Request, res: Response) => {
  const grantType = req.body?.grant_type;
  const clientId = req.body?.client_id || 'firstfix_alexa_plus_client';

  if (grantType === 'authorization_code') {
    const code = req.body?.code;
    const codeVerifier = req.body?.code_verifier;

    if (!code || !codeVerifier) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Both code and code_verifier are required for grant_type=authorization_code.',
      });
      return;
    }

    const record = authCodeStore.get(code);
    if (!record) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid or has expired.',
      });
      return;
    }

    authCodeStore.delete(code); // Single-use guarantee

    if (Date.now() > record.expiresAt) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code expired.',
      });
      return;
    }

    // Verify S256 PKCE: SHA256(code_verifier) in base64url must match code_challenge
    const computedChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    if (computedChallenge !== record.codeChallenge) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'PKCE S256 code_verifier validation failed.',
      });
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const claims: OAuthTokenClaims = {
      sub: record.clientId,
      client_id: record.clientId,
      scope: record.scope,
      iat: nowSec,
      exp: nowSec + 3600,
      iss: 'firstfix-mcp-oauth21',
    };

    const accessToken = signOAuthToken(claims);
    res.status(200).json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: record.scope,
    });
    return;
  }

  if (grantType === 'client_credentials') {
    const scope = req.body?.scope || 'mcp:tools ucp:checkout booking:spi ring:access';
    const nowSec = Math.floor(Date.now() / 1000);
    const claims: OAuthTokenClaims = {
      sub: clientId,
      client_id: clientId,
      scope,
      iat: nowSec,
      exp: nowSec + 3600,
      iss: 'firstfix-mcp-oauth21',
    };

    const accessToken = signOAuthToken(claims);
    res.status(200).json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope,
    });
    return;
  }

  res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: "Supported grant_types are 'authorization_code' (with PKCE) and 'client_credentials'.",
  });
});

/**
 * GET /oauth/verify
 * Verifies active Bearer token and returns decoded claims
 */
oauthRouter.get('/oauth/verify', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : (req.query.token as string);

  if (!token) {
    res.status(400).json({ active: false, error: 'No token provided' });
    return;
  }

  const claims = verifyOAuthToken(token);
  if (!claims) {
    res.status(200).json({ active: false });
    return;
  }

  res.status(200).json({
    active: true,
    client_id: claims.client_id,
    scope: claims.scope,
    sub: claims.sub,
    exp: claims.exp,
    iat: claims.iat,
  });
});

/**
 * Middleware: Enforces OAuth 2.1 Bearer Token Validation with RFC 9728 WWW-Authenticate headers
 */
export function createOAuth21ValidationMiddleware(baseUrl: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const enforce = req.headers['x-enforce-oauth'] === 'true';

    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        res.setHeader(
          'WWW-Authenticate',
          `Bearer realm="firstfix-mcp", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource", error="invalid_token", error_description="Authorization header must use Bearer scheme."`
        );
        res.status(401).json({
          error: 'invalid_token',
          message: 'Malformed authorization header. Expected Bearer token.',
        });
        return;
      }

      const token = authHeader.slice('Bearer '.length).trim();
      const claims = verifyOAuthToken(token);

      if (!claims) {
        res.setHeader(
          'WWW-Authenticate',
          `Bearer realm="firstfix-mcp", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource", error="invalid_token", error_description="The access token signature is invalid or expired."`
        );
        res.status(401).json({
          error: 'invalid_token',
          message: 'The OAuth 2.1 access token signature is invalid or expired per RFC 9728.',
        });
        return;
      }

      (req as any).oauth = claims;
      next();
      return;
    }

    if (enforce) {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="firstfix-mcp", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource", error="missing_token", error_description="OAuth 2.1 Bearer token is required when enforcement is enabled."`
      );
      res.status(401).json({
        error: 'unauthorized',
        message: 'Bearer token required for protected resource access.',
      });
      return;
    }

    // Default open access for stateless CLI/test calls
    next();
  };
}
