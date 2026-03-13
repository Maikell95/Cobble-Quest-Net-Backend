// ==========================================
// Pelican Panel API Client
// ==========================================
// Uses two API key types:
//   - Application key (papp_): list servers, admin info  → /api/application/...
//   - Client key (pacc_):     commands, files, resources → /api/client/...

import env from './env.js';

// ---- Headers for each API type ----

function applicationHeaders(): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.PELICAN_API_KEY}`,
  };
}

function clientHeaders(): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.PELICAN_CLIENT_API_KEY}`,
  };
}

// ---- Types ----

export interface WhitelistEntry {
  uuid: string;
  name: string;
}

export interface PelicanServerSummary {
  identifier: string;
  name: string;
  isSuspended: boolean;
}

export interface OnlinePlayersSnapshot {
  serverId: string;
  serverName: string;
  currentState: string;
  onlineCount: number;
  players: string[];
  sourceLogFile: string | null;
  rawLine: string | null;
  attemptedLogFiles: string[];
}

interface ApplicationServerResponse {
  data?: Array<{
    attributes?: {
      identifier?: string;
      name?: string;
      suspended?: boolean;
    };
  }>;
}

interface ParsedOnlineLine {
  count: number;
  players: string[];
  rawLine: string;
}

// ---- Constants ----

// Velocity glist output patterns:
//   [servername] (count): player1, player2
//   N players are currently connected to the proxy.
const VELOCITY_SERVER_LINE = /^\[.*?\]\s*\[.*?\]:\s*\[(\w+)\]\s*\((\d+)\)\s*:\s*(.+)$/;
const VELOCITY_TOTAL_LINE = /(\d+)\s+players?\s+are\s+currently\s+connected/i;

// Standard Minecraft list output patterns:
const ONLINE_LOG_PATTERNS = [
  /There are\s+(\d+)\s+of\s+a\s+max\s+of\s+\d+\s+players?\s+online\s*:\s*(.*)$/i,
  /(\d+)\s*\/\s*\d+\s+players?\s+online\s*:\s*(.*)$/i,
  /players?\s+online\s*\((\d+)\)\s*:\s*(.*)$/i,
  /connected\s+players\s*:\s*(.*)$/i,
  /online\s*:\s*(.*)$/i,
];

const DEFAULT_LOG_FILES = [
  '/logs/latest.log',
  '/logs/proxy.log.0',
  '/logs/proxy.log.1',
  '/logs/velocity.log',
  '/logs/console.log',
];

// ---- Helpers ----

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeFilePath(filePath: string): string {
  const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`;
  return encodeURIComponent(normalized);
}

function splitPlayers(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !/^none$/i.test(part));
}

function parseOnlineLine(line: string): ParsedOnlineLine | null {
  for (const pattern of ONLINE_LOG_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;

    if (match.length >= 3) {
      const count = Number.parseInt(match[1], 10);
      const players = splitPlayers(match[2] ?? '');
      const safeCount = Number.isFinite(count) ? count : players.length;
      return { count: safeCount, players, rawLine: line };
    }

    const players = splitPlayers(match[1] ?? '');
    return { count: players.length, players, rawLine: line };
  }
  return null;
}

function parseOnlineFromLog(logText: string): ParsedOnlineLine | null {
  const lines = logText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // First try Velocity glist format: [server] (count): player1, player2
  const velocityPlayers: string[] = [];
  let velocityTotal = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const serverMatch = lines[i].match(VELOCITY_SERVER_LINE);
    if (serverMatch) {
      const players = splitPlayers(serverMatch[3] ?? '');
      velocityPlayers.push(...players);
      continue;
    }
    const totalMatch = lines[i].match(VELOCITY_TOTAL_LINE);
    if (totalMatch) {
      velocityTotal = Number.parseInt(totalMatch[1], 10);
      // Found the summary line — we have all the data from glist all
      if (velocityPlayers.length > 0 || velocityTotal === 0) {
        const unique = Array.from(new Set(velocityPlayers));
        return {
          count: velocityTotal || unique.length,
          players: unique,
          rawLine: lines[i],
        };
      }
    }
  }

  // If we collected velocity players but missed the total line
  if (velocityPlayers.length > 0) {
    const unique = Array.from(new Set(velocityPlayers));
    return { count: unique.length, players: unique, rawLine: 'velocity glist' };
  }

  // Fallback: standard Minecraft format
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parsed = parseOnlineLine(lines[i]);
    if (parsed) return parsed;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Configuration checks ----

/** Check if Application API (server listing) is configured */
export function isApplicationApiConfigured(): boolean {
  return !!(env.PELICAN_URL && env.PELICAN_API_KEY);
}

/** Check if Client API (commands, files) is configured */
export function isClientApiConfigured(): boolean {
  return !!(env.PELICAN_URL && env.PELICAN_CLIENT_API_KEY);
}

/** Legacy compat — returns true if we can at least list servers or execute commands */
export function isPelicanConfigured(): boolean {
  return isApplicationApiConfigured() || isClientApiConfigured();
}

/** Returns the list of game server IDs configured */
export function getConfiguredServerIds(): string[] {
  const ids: string[] = [];
  if (env.PELICAN_SERVER_ID) ids.push(env.PELICAN_SERVER_ID);
  if (env.PELICAN_LOBBY_SERVER_ID && env.PELICAN_LOBBY_SERVER_ID !== env.PELICAN_SERVER_ID) {
    ids.push(env.PELICAN_LOBBY_SERVER_ID);
  }
  return ids;
}

// ==========================================
// Application API  (/api/application/...)
// Uses: papp_ key
// ==========================================

/**
 * List all servers from the Application API.
 */
export async function getPelicanServers(): Promise<PelicanServerSummary[]> {
  if (!isApplicationApiConfigured()) {
    throw new Error('Application API not configured');
  }

  const url = `${env.PELICAN_URL}/api/application/servers`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: applicationHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pelican servers list failed (${res.status}): ${text}`);
  }

  const payload = (await res.json()) as ApplicationServerResponse;
  const rows = payload.data ?? [];

  return rows
    .map((row) => row.attributes)
    .filter((attrs): attrs is NonNullable<typeof attrs> => !!attrs?.identifier)
    .map((attrs) => ({
      identifier: attrs.identifier ?? '',
      name: attrs.name ?? attrs.identifier ?? 'unknown',
      isSuspended: !!attrs.suspended,
    }));
}

// ==========================================
// Client API  (/api/client/...)
// Uses: pacc_ key
// ==========================================

/**
 * Send a command to a specific server via Client API.
 */
export async function sendServerCommand(serverId: string, command: string): Promise<void> {
  if (!isClientApiConfigured()) {
    throw new Error('Client API not configured — cannot send commands');
  }

  if (!serverId || typeof serverId !== 'string') {
    throw new Error('Invalid server identifier');
  }

  if (!command || typeof command !== 'string' || command.length > 500) {
    throw new Error('Invalid command');
  }

  const url = `${env.PELICAN_URL}/api/client/servers/${serverId}/command`;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: clientHeaders(),
    body: JSON.stringify({ command }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pelican command failed (${res.status}): ${text}`);
  }
}

/**
 * Send a game command to the Lobby server (Minecraft commands like say, lp, give).
 * Velocity is a proxy and doesn't support game commands — use sendVelocityCommand() for proxy commands.
 * Falls back to primary game server if Lobby is not configured.
 */
export async function sendCommand(command: string): Promise<void> {
  const serverId = env.PELICAN_LOBBY_SERVER_ID || env.PELICAN_SERVER_ID;
  await sendServerCommand(serverId, command);
}

/**
 * Send a proxy-level command to Velocity (glist, send, alert, etc.).
 */
export async function sendVelocityCommand(command: string): Promise<void> {
  if (!env.PELICAN_VELOCITY_SERVER_ID) {
    throw new Error('Velocity server not configured');
  }
  await sendServerCommand(env.PELICAN_VELOCITY_SERVER_ID, command);
}

/**
 * Send a command to all configured game servers (primary + lobby).
 */
export async function sendCommandToAll(command: string): Promise<{ serverId: string; success: boolean; error?: string }[]> {
  const serverIds = getConfiguredServerIds();
  const results: { serverId: string; success: boolean; error?: string }[] = [];

  for (const serverId of serverIds) {
    try {
      await sendServerCommand(serverId, command);
      results.push({ serverId, success: true });
    } catch (err) {
      results.push({ serverId, success: false, error: (err as Error).message });
    }
  }

  return results;
}

/**
 * Read any file contents from a server via Client API.
 */
export async function getServerFileContents(serverId: string, filePath: string): Promise<string> {
  if (!isClientApiConfigured()) {
    throw new Error('Client API not configured — cannot read files');
  }

  const encodedFile = normalizeFilePath(filePath);
  const url = `${env.PELICAN_URL}/api/client/servers/${serverId}/files/contents?file=${encodedFile}`;

  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: clientHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pelican file read failed (${res.status}): ${text}`);
  }

  return await res.text();
}

/**
 * Get basic resource state for one server via Client API.
 */
export async function getServerResources(serverId: string): Promise<{ current_state?: string }> {
  if (!isClientApiConfigured()) {
    throw new Error('Client API not configured — cannot get resources');
  }

  const url = `${env.PELICAN_URL}/api/client/servers/${serverId}/resources`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: clientHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pelican resources read failed (${res.status}): ${text}`);
  }

  return (await res.json()) as { current_state?: string };
}

/**
 * Get the server's whitelist by reading whitelist.json via Client API.
 */
export async function getWhitelist(): Promise<WhitelistEntry[]> {
  return getServerWhitelist(env.PELICAN_SERVER_ID);
}

export async function getServerWhitelist(serverId: string): Promise<WhitelistEntry[]> {
  const url = `${env.PELICAN_URL}/api/client/servers/${serverId}/files/contents?file=%2Fwhitelist.json`;

  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: clientHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pelican whitelist read failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('Pelican whitelist response is not an array');
  }

  return data as WhitelistEntry[];
}

/**
 * Check if a username exists in the server whitelist.
 */
export async function isPlayerWhitelisted(username: string): Promise<WhitelistEntry | null> {
  const whitelist = await getWhitelist();
  const entry = whitelist.find(
    (e) => e.name.toLowerCase() === username.toLowerCase(),
  );
  return entry ?? null;
}

/**
 * Get online players by sending probe commands and parsing server logs.
 * For Velocity, uses 'glist all'. For Minecraft servers, uses 'list'.
 */
export async function getOnlinePlayersSnapshot(
  serverId: string,
  serverName: string,
  logFiles: string[] = DEFAULT_LOG_FILES,
): Promise<OnlinePlayersSnapshot> {
  let currentState = 'unknown';

  try {
    const resources = await getServerResources(serverId);
    currentState = resources.current_state ?? 'unknown';
  } catch {
    // Keep unknown state if resources endpoint fails.
  }

  // Determine probe commands based on server type
  const isVelocity = serverId === env.PELICAN_VELOCITY_SERVER_ID;
  const probeCommands = isVelocity ? ['glist all'] : ['list'];

  for (const command of probeCommands) {
    try {
      await sendServerCommand(serverId, command);
    } catch {
      // Ignore command failure
    }
  }

  await sleep(1500);

  const attemptedLogFiles: string[] = [];
  for (const filePath of logFiles) {
    attemptedLogFiles.push(filePath);
    try {
      const logText = await getServerFileContents(serverId, filePath);
      const parsed = parseOnlineFromLog(logText);
      if (parsed) {
        return {
          serverId,
          serverName,
          currentState,
          onlineCount: parsed.count,
          players: parsed.players,
          sourceLogFile: filePath,
          rawLine: parsed.rawLine,
          attemptedLogFiles,
        };
      }
    } catch {
      // Ignore file read errors
    }
  }

  return {
    serverId,
    serverName,
    currentState,
    onlineCount: 0,
    players: [],
    sourceLogFile: null,
    rawLine: null,
    attemptedLogFiles,
  };
}
