'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
require('./build.js').build();
const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if (!file.startsWith(root+path.sep) || !types[path.extname(file)]) { res.writeHead(404).end(); return; }
  fs.readFile(file,(error,data) => {
    if (error) {res.writeHead(404).end(); return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'"});
    res.end(data);
  });
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Farborgel: http://127.0.0.1:${server.address().port}`));
