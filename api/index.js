// Vercel Serverless Function API with Supabase Cloud Persistence
const https = require('https');

const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZXlobW94dnVtYm1nYXR3Z3lwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA0NzQ2NywiZXhwIjoyMTAyNjIzNDY3fQ.rwcl7cA4E4gnuIZAX7gpWoahSP5VDbrEGiLyagrpCpI";

let globalState = {
  candidates: [],
  status: 'READY',
  totalDuration: 300,
  timeRemaining: 300,
  lastUpdated: Date.now()
};

function sendJSON(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

function syncToSupabase(state) {
  try {
    const payload = JSON.stringify(state);
    const req = https.request('https://beeyhmoxvumbmgatwgyp.supabase.co/storage/v1/object/public_box/state.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'x-upsert': 'true',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, () => {});
    req.on('error', () => {});
    req.write(payload);
    req.end();
  } catch (e) {}
}

function fetchFromSupabase(callback) {
  try {
    https.get('https://beeyhmoxvumbmgatwgyp.supabase.co/storage/v1/object/public/public_box/state.json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && Array.isArray(parsed.candidates)) {
            globalState = parsed;
          }
        } catch(e) {}
        callback(globalState);
      });
    }).on('error', () => callback(globalState));
  } catch (e) {
    callback(globalState);
  }
}

module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }

  if (req.method === 'GET') {
    return fetchFromSupabase((state) => sendJSON(res, 200, state));
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    if (body && body.candId) {
      const cand = globalState.candidates.find(c => c.id === body.candId);
      if (cand) {
        cand.votes += (body.amount || 1);
        globalState.lastUpdated = Date.now();
        syncToSupabase(globalState);
        return sendJSON(res, 200, { success: true, candidates: globalState.candidates });
      }
    }

    if (body && (body.candidates || body.status)) {
      if (body.candidates) globalState.candidates = body.candidates;
      if (body.status) globalState.status = body.status;
      if (body.totalDuration !== undefined) globalState.totalDuration = body.totalDuration;
      if (body.timeRemaining !== undefined) globalState.timeRemaining = body.timeRemaining;
      globalState.lastUpdated = Date.now();
      syncToSupabase(globalState);
      return sendJSON(res, 200, { success: true, state: globalState });
    }
  }

  return sendJSON(res, 200, globalState);
};
