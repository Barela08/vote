const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const SUPABASE_DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:[YOUR-PASSWORD]@db.beeyhmoxvumbmgatwgyp.supabase.co:5432/postgres';

// Default State (Clean DB with zero dummy candidates)
let electionState = {
  candidates: [],
  status: 'READY',
  totalDuration: 300,
  timeRemaining: 300,
  lastUpdated: Date.now()
};

// SSE Active Clients
let sseClients = [];

function broadcastState() {
  electionState.lastUpdated = Date.now();
  const data = `data: ${JSON.stringify(electionState)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(data);
    } catch (e) {}
  });
}

// Global Timer Loop in Server
setInterval(() => {
  if (electionState.status === 'LIVE') {
    if (electionState.timeRemaining > 0) {
      electionState.timeRemaining--;
      broadcastState();
    } else {
      electionState.status = 'ENDED';
      broadcastState();
    }
  }
}, 1000);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];

  if (reqUrl.length > 1 && reqUrl.endsWith('/')) {
    reqUrl = reqUrl.slice(0, -1);
  }

  // Real-Time SSE Stream Endpoint
  if (reqUrl === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify(electionState)}\n\n`);
    sseClients.push(res);

    req.on('close', () => {
      sseClients = sseClients.filter(client => client !== res);
    });
    return;
  }

  // REST APIs
  if (req.method === 'GET' && reqUrl === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(electionState));
    return;
  }

  if (req.method === 'POST' && reqUrl === '/api/vote') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { candId, amount } = JSON.parse(body);
        const cand = electionState.candidates.find(c => c.id === candId);
        if (cand) {
          cand.votes += (amount || 1);
          broadcastState();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, candidates: electionState.candidates }));
        } else {
          res.writeHead(404);
          res.end('Candidate not found');
        }
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid payload');
      }
    });
    return;
  }

  if (req.method === 'POST' && reqUrl === '/api/admin/update') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.candidates) electionState.candidates = payload.candidates;
        if (payload.status) electionState.status = payload.status;
        if (payload.totalDuration !== undefined) electionState.totalDuration = payload.totalDuration;
        if (payload.timeRemaining !== undefined) electionState.timeRemaining = payload.timeRemaining;
        
        broadcastState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid payload');
      }
    });
    return;
  }

  // Handle /admin URL route
  if (reqUrl === '/admin') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    return;
  }

  // Default file routing
  let filePath = path.join(__dirname, reqUrl === '/' ? 'index.html' : reqUrl);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'text/html';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), (err2, fallbackContent) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(fallbackContent);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`VotePro Server running smoothly at http://localhost:${PORT}/`);
  console.log(`Real-Time Sync Active (Supabase Endpoint: ${SUPABASE_DB_URL})`);
});
