import { z } from 'zod';

export const OAuthAuthorizationServerMetadataSchema = z.object({
  issuer: z.string().url(),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  jwks_uri: z.string().url(),
  response_types_supported: z.array(z.string()).min(1),
  grant_types_supported: z.array(z.string()).min(1),
  token_endpoint_auth_methods_supported: z.array(z.string()).min(1),
  code_challenge_methods_supported: z.array(z.string()).min(1),
  scopes_supported: z.array(z.string()).min(1),
});

export type OAuthAuthorizationServerMetadata = z.infer<typeof OAuthAuthorizationServerMetadataSchema>;

export const OAuthProtectedResourceMetadataSchema = z.object({
  resource: z.string().url(),
  authorization_servers: z.array(z.string().url()).min(1),
  scopes_supported: z.array(z.string()).min(1),
  bearer_methods_supported: z.array(z.string()).min(1),
});

export type OAuthProtectedResourceMetadata = z.infer<typeof OAuthProtectedResourceMetadataSchema>;

export const UcpDiscoveryProfileSchema = z.object({
  version: z.string(),
  provider: z.string(),
  endpoints: z.object({
    checkout_sessions: z.string(),
    orders: z.string(),
    refunds: z.string(),
  }),
  supported_payment_handlers: z.array(z.string()).min(1),
  supported_currencies: z.array(z.string()).min(1),
  capabilities: z.array(z.string()).min(1),
});

export type UcpDiscoveryProfile = z.infer<typeof UcpDiscoveryProfileSchema>;

export function getOAuthAuthorizationServerMetadata(baseUrl: string): OAuthAuthorizationServerMetadata {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return {
    issuer: normalizedBase,
    authorization_endpoint: `${normalizedBase}/oauth/authorize`,
    token_endpoint: `${normalizedBase}/oauth/token`,
    jwks_uri: `${normalizedBase}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:read', 'mcp:write', 'booking:dispatch', 'ucp:checkout'],
  };
}

export function getOAuthProtectedResourceMetadata(baseUrl: string): OAuthProtectedResourceMetadata {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return {
    resource: `${normalizedBase}/mcp`,
    authorization_servers: [normalizedBase],
    scopes_supported: ['mcp:read', 'mcp:write', 'booking:dispatch'],
    bearer_methods_supported: ['header'],
  };
}

export function getUcpDiscoveryProfile(baseUrl: string): UcpDiscoveryProfile {
  return {
    version: '1.0',
    provider: 'FirstFix Home Services',
    endpoints: {
      checkout_sessions: '/checkout-sessions',
      orders: '/orders',
      refunds: '/refunds',
    },
    supported_payment_handlers: [
      'com.amazon.payments.network_token',
      'com.amazon.payments.stored_payment_method',
    ],
    supported_currencies: ['USD'],
    capabilities: [
      'instant_deposit_hold',
      'credit_to_final_repair_invoice',
      'split_technician_escrow',
    ],
  };
}
