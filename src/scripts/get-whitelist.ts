import 'dotenv/config.js';
import env from '../config/env.js';

interface WhitelistEntry {
  uuid: string;
  name: string;
}

const url = `${env.PELICAN_URL}/api/client/servers/${env.PELICAN_SERVER_ID}/files/contents?file=%2Fwhitelist.json`;

try {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${env.PELICAN_API_KEY}`,
    },
  });

  const data = (await res.json()) as unknown;

  if (!res.ok) {
    console.error('\nError al obtener whitelist:', data);
    process.exit(1);
  }

  console.log('\n=== WHITELIST DEL SERVIDOR ===\n');

  if (!Array.isArray(data) || data.length === 0) {
    console.log('La whitelist esta vacia.\n');
  } else {
    console.log(`Total: ${data.length} jugador${data.length !== 1 ? 'es' : ''}\n`);
    console.log('No.  Nombre              UUID');
    console.log('-'.repeat(80));

    (data as WhitelistEntry[]).forEach((entry, i) => {
      const num = (i + 1).toString().padStart(2);
      const name = entry.name.padEnd(16);
      console.log(`${num}.  ${name}  ${entry.uuid}`);
    });

    console.log('-'.repeat(80));
    console.log('');
  }
} catch (err) {
  console.error('\nError:', err instanceof Error ? err.message : String(err), '\n');
  process.exit(1);
}
