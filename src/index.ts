export * from './types/index.js';
export * from './schemas/discovery.js';
export * from './data/seedData.js';
export * from './storage/storageAdapter.js';
export * from './engine/firstFixEngine.js';

export const FIRSTFIX_SERVICE_INFO = {
  name: 'FirstFix MCP',
  version: '1.0.0',
  description:
    'Multimodal serial-plate diagnostic, OEM part matcher, and stocked-van booking engine for Alexa+',
};
