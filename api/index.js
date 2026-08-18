// Vercel Serverless Function API (Clean Database)
let electionState = {
  candidates: [],
  status: 'READY',
  totalDuration: 300,
  timeRemaining: 300,
  lastUpdated: Date.now()
};
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

module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }

  if (req.method === 'GET') {
    return sendJSON(res, 200, electionState);
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    if (body && body.candId) {
      const cand = electionState.candidates.find(c => c.id === body.candId);
      if (cand) {
        cand.votes += (body.amount || 1);
        return sendJSON(res, 200, { success: true, candidates: electionState.candidates });
      }
    }

    if (body && (body.candidates || body.status)) {
      if (body.candidates) electionState.candidates = body.candidates;
      if (body.status) electionState.status = body.status;
      if (body.totalDuration !== undefined) electionState.totalDuration = body.totalDuration;
      if (body.timeRemaining !== undefined) electionState.timeRemaining = body.timeRemaining;
      return sendJSON(res, 200, { success: true, state: electionState });
    }
  }

  return sendJSON(res, 200, electionState);
};
