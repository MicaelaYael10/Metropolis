// Sirve web/dist como estatico. vite preview y el dev server rechazan el Host de un tunel
// (proteccion contra DNS rebinding), asi que para demos publicas se usa este servidor.
// Uso: node scripts/serve-web.js [carpeta] [puerto]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(process.argv[2] || 'web/dist');
const PORT = Number(process.argv[3] || 3000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, code, body, type) {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT + path.sep)) {
    send(res, 403, '403', TYPES['.txt']);
    return;
  }
  fs.readFile(file, (err, body) => {
    if (!err) {
      send(res, 200, body, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
      return;
    }
    fs.readFile(path.join(ROOT, 'index.html'), (err2, html) => {
      if (err2) {
        send(res, 404, '404', TYPES['.txt']);
        return;
      }
      send(res, 200, html, TYPES['.html']);
    });
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('http://127.0.0.1:' + PORT + '/ -> ' + ROOT);
});
