#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'site');
const port = Number(process.argv[process.argv.indexOf('-p') + 1]) || 8080;

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    }[ext] || 'text/plain; charset=utf-8'
  );
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(root, urlPath);
  if (filePath.endsWith('/')) filePath += 'index.html';
  if (!path.extname(filePath)) filePath += '/index.html';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + urlPath + '\n');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`[dev-site] Serving ${root} on http://localhost:${port}`);
});
