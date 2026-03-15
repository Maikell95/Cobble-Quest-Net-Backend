import 'dotenv/config';
import https from 'https';
import fs from 'fs';

const pelican_url = process.env.PELICAN_URL;
const pelican_api_key = process.env.PELICAN_API_KEY;

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
  const vel = await getWhitelist('540bc19e');
  const lob = await getWhitelist('03bbdbc3');
  
  let out = 'WHITELIST VELOCITY: ' + vel.join(', ') + '\nWHITELIST LOBBY: ' + lob.join(', ') + '\n';
  console.log(out);
  fs.writeFileSync('whitelist-report.txt', out);
})();
