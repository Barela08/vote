// Vercel Serverless Function API with Supabase Cloud Persistence & ENV variables
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://beeyhmoxvumbmgatwgyp.supabase.co";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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
    const targetUrl = new URL('/storage/v1/object/public_box/state.json', SUPABASE_URL);
    const req = https.request(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
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
    const fetchUrl = new URL('/storage/v1/object/public/public_box/state.json', SUPABASE_URL);
    https.get(fetchUrl, (res) => {
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

function mergeServerCandidates(newCandidates) {
  if (!Array.isArray(newCandidates)) return;
  const map = new Map();
  if (Array.isArray(globalState.candidates)) {
    globalState.candidates.forEach(c => map.set(c.id, c));
  }
  newCandidates.forEach(c => {
    if (map.has(c.id)) {
      const existing = map.get(c.id);
      existing.votes = Math.max(existing.votes || 0, c.votes || 0);
      if (c.name) existing.name = c.name;
      if (c.party) existing.party = c.party;
      if (c.avatar) existing.avatar = c.avatar;
    } else {
      map.set(c.id, c);
    }
  });
  globalState.candidates = Array.from(map.values());
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

    if (body && (body.candidates || body.status || body.deleteCandId)) {
      if (body.deleteCandId) {
        globalState.candidates = globalState.candidates.filter(c => c.id !== body.deleteCandId);
      } else if (Array.isArray(body.candidates)) {
        globalState.candidates = body.candidates;
      }
      if (body.status) {
        globalState.status = body.status;
      }
      if (body.totalDuration !== undefined) globalState.totalDuration = body.totalDuration;
      if (body.timeRemaining !== undefined) globalState.timeRemaining = body.timeRemaining;
      if (body.endTime !== undefined) globalState.endTime = body.endTime;
      globalState.lastUpdated = Date.now();
      syncToSupabase(globalState);
      return sendJSON(res, 200, { success: true, state: globalState });
    }
  }

  return sendJSON(res, 200, globalState);
};
