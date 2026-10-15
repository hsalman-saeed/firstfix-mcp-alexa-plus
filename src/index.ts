export * from './types/index.js';
export * from './schemas/discovery.js';
export * from './data/seedData.js';
export * from './storage/storageAdapter.js';
export * from './engine/firstFixEngine.js';
export * from './server/state.js';
export * from './server/mcpServer.js';
export * from './server/ucpCheckout.js';
export * from './server/localBookingSpi.js';
export * from './server/ringAccess.js';
export * from './server/app.js';
export * from './ai/safetyGuardrails.js';
export * from './ai/ratingPlateVision.js';
export * from './ai/firstFixAgent.js';

export const FIRSTFIX_SERVICE_INFO = {
  name: 'FirstFix MCP',
  version: '1.0.0',
  description:
    'Multimodal serial-plate diagnostic, OEM part matcher, and stocked-van booking engine for Alexa+',
};
