import 'dotenv/config';

const pelicanUrl = process.env.PELICAN_URL;
const pelicanApiKey = process.env.PELICAN_API_KEY;
const serverId = process.argv[2] || process.env.PELICAN_SERVER_ID;

if (!pelicanUrl || !pelicanApiKey || !serverId) {
  console.error('Missing Pelican configuration.');
  process.exit(1);
}

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${pelicanApiKey}`,
};

async function pelicanRequest(path, options = {}) {
  const response = await fetch(`${pelicanUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function getLogText(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    if (typeof payload.data === 'string') {
      return payload.data;
    }

    if (typeof payload.contents === 'string') {
      return payload.contents;
    }
  }

  return '';
}

function extractPlayersFromLog(logText) {
  const lines = logText.split(/\r?\n/).filter(Boolean);
  const candidates = lines.filter((line) => /players online|There are .* online|Connected players|online:/i.test(line));
  const lastMatch = candidates.at(-1);

  if (!lastMatch) {
    return { line: null, players: null };
  }

  const colonIndex = lastMatch.lastIndexOf(':');
  if (colonIndex === -1) {
    return { line: lastMatch, players: [] };
  }

  const suffix = lastMatch.slice(colonIndex + 1).trim();
  if (!suffix) {
    return { line: lastMatch, players: [] };
  }

  const players = suffix
    .split(',')
    .map((player) => player.trim())
    .filter(Boolean)
    .filter((player) => !/^none$/i.test(player));

  return { line: lastMatch, players };
}

async function main() {
  const resources = await pelicanRequest(`/api/client/servers/${serverId}/resources`, {
    method: 'GET',
  });

  console.log(`Server ID: ${serverId}`);
  if (resources.ok) {
    console.log('Resources endpoint: OK');
    if (resources.data && typeof resources.data === 'object') {
      console.log(`Current state: ${resources.data.current_state || 'unknown'}`);
      if (resources.data.resources && typeof resources.data.resources === 'object') {
        const uptime = resources.data.resources.uptime ?? 'unknown';
        console.log(`Uptime: ${uptime}`);
      }
    }
  } else {
    console.log(`Resources endpoint failed: ${resources.status}`);
  }

  const command = await pelicanRequest(`/api/client/servers/${serverId}/command`, {
    method: 'POST',
    body: JSON.stringify({ command: 'list' }),
  });

  if (!command.ok) {
    console.error(`Command failed: ${command.status}`);
    console.error(typeof command.data === 'string' ? command.data : JSON.stringify(command.data));
    process.exit(1);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const latestLog = await pelicanRequest(`/api/client/servers/${serverId}/files/contents?file=%2Flogs%2Flatest.log`, {
    method: 'GET',
  });

  if (!latestLog.ok) {
    console.error(`Log read failed: ${latestLog.status}`);
    console.error(typeof latestLog.data === 'string' ? latestLog.data : JSON.stringify(latestLog.data));
    process.exit(1);
  }

  const logText = getLogText(latestLog.data);
  const result = extractPlayersFromLog(logText);

  console.log('Online query result:');
  if (!result.line) {
    console.log('No matching online-player line found in latest.log');
    return;
  }

  console.log(result.line);
  if (!result.players) {
    console.log('Could not parse player names from the log line.');
    return;
  }

  if (result.players.length === 0) {
    console.log('Players online: 0');
    return;
  }

  console.log(`Players online: ${result.players.length}`);
  for (const player of result.players) {
    console.log(`- ${player}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
