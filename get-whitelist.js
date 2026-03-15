import 'dotenv/config';
import https from 'https';

const pelican_url = process.env.PELICAN_URL;
const pelican_api_key = process.env.PELICAN_API_KEY;
const pelican_server_id = process.env.PELICAN_SERVER_ID;

if (!pelican_url || !pelican_api_key || !pelican_server_id) {
  console.error('❌ Faltan variables de entorno: PELICAN_URL, PELICAN_API_KEY, PELICAN_SERVER_ID');
  process.exit(1);
}

const url = `${pelican_url}/api/client/servers/${pelican_server_id}/files/contents?file=%2Fwhitelist.json`;

const options = {
  headers: {
    'Accept': 'application/json',
    'Authorization': `Bearer ${pelican_api_key}`
  }
};

https.get(url, options, (res) => {
  let data = '';
  
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('\n📋 Whitelist del servidor:\n');
      
      if (Array.isArray(parsed)) {
        parsed.forEach((entry, index) => {
          console.log(`${index + 1}. ${entry.name}`);
        });
        console.log(`\n✅ Total: ${parsed.length} jugadores whitelisteados\n`);
      } else {
        console.log('Respuesta:', parsed);
      }
    } catch (e) {
      console.error('❌ Error al parsear JSON:', e.message);
      console.log('Respuesta cruda:', data);
    }
  });
}).on('error', (err) => {
  console.error('❌ Error en la llamada HTTP:', err.message);
});
