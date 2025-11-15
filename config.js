import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo } from './logger.js';
import { getFactoryCliVersion } from './version-updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let config = null;
let cachedUserAgent = null;

export function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configData);
    return config;
  } catch (error) {
    throw new Error(`Failed to load config.json: ${error.message}`);
  }
}

export function getConfig() {
  if (!config) {
    loadConfig();
  }
  return config;
}

export function getModelById(modelId) {
  const cfg = getConfig();
  return cfg.models.find(m => m.id === modelId);
}

export function getEndpointByType(type) {
  const cfg = getConfig();
  return cfg.endpoint.find(e => e.name === type);
}

export function isDevMode() {
  const cfg = getConfig();
  return cfg.dev_mode === true;
}

export function getPort() {
  const cfg = getConfig();
  return cfg.port || 3000;
}

export function getSystemPrompt() {
  const cfg = getConfig();
  return cfg.system_prompt || '';
}

export function getModelReasoning(modelId) {
  const model = getModelById(modelId);
  if (!model || !model.reasoning) {
    return null;
  }
  const reasoningLevel = model.reasoning.toLowerCase();
  if (['low', 'medium', 'high', 'auto'].includes(reasoningLevel)) {
    return reasoningLevel;
  }
  return null;
}

export async function getUserAgent() {
  // Return cached value if available
  if (cachedUserAgent) {
    return cachedUserAgent;
  }

  // Get latest version and cache it
  const version = await getFactoryCliVersion();
  cachedUserAgent = `factory-cli/${version}`;
  return cachedUserAgent;
}

// Synchronous version for backward compatibility (uses cached value)
export function getUserAgentSync() {
  if (cachedUserAgent) {
    return cachedUserAgent;
  }
  // Fallback to config or default
  const cfg = getConfig();
  return cfg.user_agent || 'factory-cli/0.25.2';
}

export function getProxyConfigs() {
  const cfg = getConfig();
  if (!Array.isArray(cfg.proxies)) {
    return [];
  }
  return cfg.proxies.filter(proxy => proxy && typeof proxy === 'object');
}

export function getRedirectedModelId(modelId) {
  const cfg = getConfig();
  if (cfg.model_redirects && cfg.model_redirects[modelId]) {
    const redirectedId = cfg.model_redirects[modelId];
    console.log(`[REDIRECT] Model redirected: ${modelId} -> ${redirectedId}`);
    logInfo(`Model redirected: ${modelId} -> ${redirectedId}`);
    return redirectedId;
  }
  return modelId;
}
