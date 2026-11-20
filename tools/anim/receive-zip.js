// Task 116 (measurement helper, not a test): a tiny receiver for the browser run. The page PUTs the exported ZIP to http://localhost:8952/<name>; it is written to the directory given as argv[2] (CORS open, localhost only).
//   node tools/anim/receive-zip.js /path/to/dir
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[2]; if (!dir) { console.error('usage: node tools/anim/receive-zip.js DIR'); process.exit(2); }
fs.mkdirSync(dir, { recursive: true });
http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method !== 'PUT') { res.writeHead(405); res.end(); return; }
    const name = path.basename(decodeURIComponent(req.url.slice(1))).replace(/[^A-Za-z0-9._-]/g, '_');
    const out = fs.createWriteStream(path.join(dir, name)); req.pipe(out);
    out.on('finish', () => { res.writeHead(200); res.end('ok'); console.log('received ' + name); });
}).listen(8952, '127.0.0.1', () => console.log('listening on 8952'));
