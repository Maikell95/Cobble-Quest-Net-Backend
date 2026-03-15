import 'dotenv/config';
import https from 'https';

const pelican_url = process.env.PELICAN_URL;
const pelican_api_key = process.env.PELICAN_API_KEY;

if (!pelican_url || !pelican_api_key) {
  console.error('❌ Faltan variables de entorno: PELICAN_URL, PELICAN_API_KEY');
  process.exit(1);
}

const url = `${pelican_url}/api/client`;

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
      
      console.log('\n📊 SERVIDORES EN PELICAN PANEL:\n');
      console.log('ID                              Nombre                   Estado');
      console.log('─'.repeat(80));
      
      if (parsed.data && Array.isArray(parsed.data)) {
        parsed.data.forEach((server) => {
          const id = server.attributes.identifier.padEnd(32);
          const name = server.attributes.name.substring(0, 24).padEnd(24);
          const status = server.attributes.is_node_under_maintenance ? '⚠️ Mantenimiento' : '✅ Online';
          console.log(`${id}${name}${status}`);
        });
        console.log('─'.repeat(80));
        console.log(`\n✅ Total: ${parsed.data.length} servidores\n`);
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
