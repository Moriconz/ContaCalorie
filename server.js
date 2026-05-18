#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const HOST = 'localhost';

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, decodeURIComponent(url.parse(req.url).pathname));

  // Se non ha estensione e non è un file, servire index.html (SPA)
  if (!path.extname(filePath) && fs.statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File not found</h1>');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 App disponibile su http://${HOST}:${PORT}`);
  console.log(`📂 Cartella: ${__dirname}`);
});
