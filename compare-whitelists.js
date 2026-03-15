import 'dotenv/config';
import https from 'https';

const pelican_url = process.env.PELICAN_URL;
const pelican_api_key = process.env.PELICAN_API_KEY;

const servers = {
  velocity: '540bc19e',
  lobby: '03bbdbc3'
};

const getWhitelist = (serverId) => {
  return new Promise((resolve) => {
    const url = `${pelican_url}/api/client/servers/${serverId}/files/contents?file=%2Fwhitelist.json`;
    const options = {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${pelican_api_key}`
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const arr = Array.isArray(parsed) ? parsed : (parsed.data || []);
          resolve(arr.map(p => p.name || p));
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
};

(async () => {
  const velocity = await getWhitelist(servers.velocity);
  const lobby = await getWhitelist(servers.lobby);
  
  const velocitySet = new Set(velocity);
  const lobbySet = new Set(lobby);
  const allPlayers = new Set([...velocity, ...lobby]);

  console.log('\nVELOCITY (' + velocity.length + '):');
  velocity.forEach((p, i) => console.log(`${(i+1).toString().padStart(2)}. ${p}`));

  console.log('\nLOBBY (' + lobby.length + '):');
  lobby.forEach((p, i) => console.log(`${(i+1).toString().padStart(2)}. ${p}`));

  const common = velocity.filter(p => lobbySet.has(p));
  const onlyVel = velocity.filter(p => !lobbySet.has(p));
  const onlyLob = lobby.filter(p => !velocitySet.has(p));

  console.log('\nEN AMBOS (' + common.length + '):');
  common.forEach(p => console.log(`✓ ${p}`));

  console.log('\nSOLO VELOCITY (' + onlyVel.length + '):');
  onlyVel.forEach(p => console.log(`✗ ${p}`));

  console.log('\nSOLO LOBBY (' + onlyLob.length + '):');
  onlyLob.forEach(p => console.log(`✗ ${p}`));

  console.log(`\nTOTAL UNICO: ${allPlayers.size} jugadores\n`);
})();
