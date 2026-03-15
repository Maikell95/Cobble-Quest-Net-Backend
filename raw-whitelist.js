import 'dotenv/config';
import https from 'https';

const url = `${process.env.PELICAN_URL}/api/client/servers/03bbdbc3/files/contents?file=%2Fwhitelist.json`;

https.get(url, {
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${process.env.PELICAN_API_KEY}`,
  },
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log(data));
}).on('error', err => console.error(err.message));
