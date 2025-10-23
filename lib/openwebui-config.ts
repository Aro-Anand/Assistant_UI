export const OPENWEBUI_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_OPENWEBUI_URL || 'http://localhost:3000',
  apiKey: process.env.NEXT_PUBLIC_OPENWEBUI_API_KEY || '',
};

export const OPENWEBUI_ENDPOINTS = {
  chat: '/api/chat/completions',
  models: '/api/models',
  uploadFile: '/api/v1/files/',
  files: '/api/v1/files',
  knowledge: '/api/v1/knowledge',
};