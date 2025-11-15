import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { logInfo, logError, logDebug } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION_CACHE_FILE = path.join(__dirname, '.version-cache.json');
const INSTALL_SCRIPT_URL = 'https://app.factory.ai/cli';
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// SDK version pools (will be updated daily)
const SDK_VERSION_POOLS = {
  anthropic: ['0.56.0', '0.57.0', '0.57.1', '0.58.0', '0.59.0'],
  openai: ['5.22.0', '5.23.0', '5.23.2', '5.24.0', '5.25.0'],
  runtime: ['v24.1.0', 'v24.2.0', 'v24.3.0', 'v24.4.0', 'v24.5.0']
};

// Client environment pools
const CLIENT_ENVIRONMENTS = [
  { os: 'MacOS', arch: 'x64', runtime: 'node' },
  { os: 'MacOS', arch: 'arm64', runtime: 'node' },
  { os: 'Linux', arch: 'x64', runtime: 'node' },
  { os: 'Windows', arch: 'x64', runtime: 'node' }
];

// Cached selections (persistent across requests)
let cachedSdkVersions = null;
let cachedEnvironment = null;

/**
 * Parse factory-cli version from installation script
 * @param {string} scriptContent - Installation script content
 * @returns {string|null} Version string or null if not found
 */
function parseVersionFromScript(scriptContent) {
  // Match: VER="0.25.2"
  const versionMatch = scriptContent.match(/VER="([0-9]+\.[0-9]+\.[0-9]+)"/);
  if (versionMatch && versionMatch[1]) {
    return versionMatch[1];
  }
  return null;
}

/**
 * Fetch latest factory-cli version from installation script
 * @returns {Promise<string|null>} Version string or null if failed
 */
async function fetchLatestVersion() {
  try {
    logDebug('Fetching latest factory-cli version from installation script...');

    const response = await fetch(INSTALL_SCRIPT_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const scriptContent = await response.text();
    const version = parseVersionFromScript(scriptContent);

    if (version) {
      logInfo(`Fetched latest factory-cli version: ${version}`);
      return version;
    } else {
      logError('Failed to parse version from installation script');
      return null;
    }
  } catch (error) {
    logError('Failed to fetch factory-cli version', error);
    return null;
  }
}

/**
 * Load version cache from file
 * @returns {Object|null} Cache object or null if not exists
 */
function loadVersionCache() {
  try {
    if (fs.existsSync(VERSION_CACHE_FILE)) {
      const cacheData = fs.readFileSync(VERSION_CACHE_FILE, 'utf-8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    logError('Failed to load version cache', error);
  }
  return null;
}

/**
 * Save version cache to file
 * @param {string} version - Version string
 * @param {Object} sdkVersions - SDK versions
 * @param {Object} environment - Client environment
 */
function saveVersionCache(version, sdkVersions = null, environment = null) {
  try {
    const cacheData = {
      version: version,
      updated_at: new Date().toISOString(),
      timestamp: Date.now()
    };

    // Add SDK versions if provided
    if (sdkVersions) {
      cacheData.sdk_versions = sdkVersions;
    }

    // Add environment if provided
    if (environment) {
      cacheData.environment = environment;
    }

    fs.writeFileSync(VERSION_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
    logDebug(`Version cache saved: ${version}`);
  } catch (error) {
    logError('Failed to save version cache', error);
  }
}

/**
 * Check if version cache needs update
 * @param {Object} cache - Cache object
 * @returns {boolean} True if needs update
 */
function needsUpdate(cache) {
  if (!cache || !cache.timestamp) {
    return true;
  }
  const elapsed = Date.now() - cache.timestamp;
  return elapsed >= UPDATE_INTERVAL_MS;
}

/**
 * Get factory-cli version with auto-update mechanism
 * - On first run: fetch from installation script
 * - On subsequent runs: use cache if < 24 hours old
 * - Auto-update cache every 24 hours
 * @returns {Promise<string>} Version string (fallback to default if failed)
 */
export async function getFactoryCliVersion() {
  const DEFAULT_VERSION = '0.25.2'; // Fallback version

  // Load cache
  const cache = loadVersionCache();

  // Check if cache is valid and fresh
  if (cache && cache.version && !needsUpdate(cache)) {
    logDebug(`Using cached factory-cli version: ${cache.version}`);
    return cache.version;
  }

  // Cache is stale or missing, fetch latest version
  logInfo('Version cache is stale or missing, fetching latest version...');
  const latestVersion = await fetchLatestVersion();

  if (latestVersion) {
    // Save to cache (preserve SDK versions and environment if they exist)
    const sdkVersions = cache?.sdk_versions || null;
    const environment = cache?.environment || null;
    saveVersionCache(latestVersion, sdkVersions, environment);
    return latestVersion;
  } else {
    // Fetch failed, use cache if available, otherwise use default
    if (cache && cache.version) {
      logInfo(`Using stale cached version: ${cache.version}`);
      return cache.version;
    } else {
      logInfo(`Using default fallback version: ${DEFAULT_VERSION}`);
      return DEFAULT_VERSION;
    }
  }
}

/**
 * Initialize version updater
 * - Fetch version on startup
 * - Schedule daily updates
 */
export async function initializeVersionUpdater() {
  logInfo('Initializing factory-cli version updater...');

  // Fetch version on startup
  const version = await getFactoryCliVersion();
  logInfo(`Factory CLI version initialized: ${version}`);

  // Initialize SDK versions and environment
  getSdkVersions();
  getClientEnvironment();

  // Schedule daily updates (CLI version + SDK versions + environment rotation)
  setInterval(async () => {
    logInfo('Running scheduled daily rotation...');
    await getFactoryCliVersion();
    await rotateSdkVersionsAndEnvironment();
  }, UPDATE_INTERVAL_MS);

  logInfo('Version updater initialized successfully');
}

/**
 * Select random SDK versions from pools
 * @returns {Object} Selected SDK versions
 */
function selectRandomSdkVersions() {
  return {
    anthropic: SDK_VERSION_POOLS.anthropic[Math.floor(Math.random() * SDK_VERSION_POOLS.anthropic.length)],
    openai: SDK_VERSION_POOLS.openai[Math.floor(Math.random() * SDK_VERSION_POOLS.openai.length)],
    runtime: SDK_VERSION_POOLS.runtime[Math.floor(Math.random() * SDK_VERSION_POOLS.runtime.length)]
  };
}

/**
 * Select random client environment
 * @returns {Object} Selected environment
 */
function selectRandomEnvironment() {
  return CLIENT_ENVIRONMENTS[Math.floor(Math.random() * CLIENT_ENVIRONMENTS.length)];
}

/**
 * Get SDK versions (cached or generate new)
 * @returns {Object} SDK versions
 */
export function getSdkVersions() {
  if (cachedSdkVersions) {
    return cachedSdkVersions;
  }

  // Try to load from cache
  const cache = loadVersionCache();
  if (cache && cache.sdk_versions) {
    cachedSdkVersions = cache.sdk_versions;
    logDebug(`Using cached SDK versions: anthropic=${cachedSdkVersions.anthropic}, openai=${cachedSdkVersions.openai}`);
    return cachedSdkVersions;
  }

  // Generate new random versions
  cachedSdkVersions = selectRandomSdkVersions();
  logInfo(`Selected SDK versions: anthropic=${cachedSdkVersions.anthropic}, openai=${cachedSdkVersions.openai}, runtime=${cachedSdkVersions.runtime}`);

  // Save to cache
  const cliVersion = cache?.version || '0.25.2';
  const environment = cache?.environment || selectRandomEnvironment();
  saveVersionCache(cliVersion, cachedSdkVersions, environment);

  return cachedSdkVersions;
}

/**
 * Get client environment (cached or generate new)
 * @returns {Object} Client environment
 */
export function getClientEnvironment() {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  // Try to load from cache
  const cache = loadVersionCache();
  if (cache && cache.environment) {
    cachedEnvironment = cache.environment;
    logDebug(`Using cached environment: ${cachedEnvironment.os} ${cachedEnvironment.arch}`);
    return cachedEnvironment;
  }

  // Generate new random environment
  cachedEnvironment = selectRandomEnvironment();
  logInfo(`Selected client environment: ${cachedEnvironment.os} ${cachedEnvironment.arch}`);

  // Save to cache
  const cliVersion = cache?.version || '0.25.2';
  const sdkVersions = cache?.sdk_versions || selectRandomSdkVersions();
  saveVersionCache(cliVersion, sdkVersions, cachedEnvironment);

  return cachedEnvironment;
}

/**
 * Rotate SDK versions and environment (called daily)
 */
async function rotateSdkVersionsAndEnvironment() {
  logInfo('Rotating SDK versions and client environment...');

  // Select new random versions and environment
  cachedSdkVersions = selectRandomSdkVersions();
  cachedEnvironment = selectRandomEnvironment();

  logInfo(`New SDK versions: anthropic=${cachedSdkVersions.anthropic}, openai=${cachedSdkVersions.openai}, runtime=${cachedSdkVersions.runtime}`);
  logInfo(`New environment: ${cachedEnvironment.os} ${cachedEnvironment.arch}`);

  // Get current CLI version
  const cliVersion = await getFactoryCliVersion();

  // Save to cache
  saveVersionCache(cliVersion, cachedSdkVersions, cachedEnvironment);
}
