const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const ROOT = path.join(__dirname, 'src');
const SOUNDS = path.join(__dirname, 'resources', 'sounds');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wav': 'audio/wav',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let filePath;
  if (req.url.startsWith('/audio/')) {
    filePath = path.join(SOUNDS, req.url.replace('/audio/', ''));
  } else {
    filePath = path.join(ROOT, req.url === '/' ? 'audio-trimmer.html' : req.url);
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found: ' + req.url);
      return;
    }

    // Support range requests for large files
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Trimmer server running at http://localhost:${PORT}/audio-trimmer.html`);
});
