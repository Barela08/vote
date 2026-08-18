// Vercel Serverless Function API
let electionState = {
  candidates: [
    {
      id: 'cand_1',
      name: 'Narendra Modi',
      party: 'Bharatiya Janata Party (BJP) 🥭',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      bio: 'Development & Economic Reform Agenda',
      votes: 12
    },
    {
      id: 'cand_2',
      name: 'Rahul Gandhi',
      party: 'Indian National Congress (INC) ✋',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      bio: 'Nyay Agenda & Democratic Reform',
      votes: 8
    },
    {
      id: 'cand_3',
      name: 'Arvind Kejriwal',
      party: 'Aam Aadmi Party (AAP) 🧹',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
      bio: 'Education, Healthcare & Urban Governance',
      votes: 5
    }
  ],
  status: 'LIVE',
  totalDuration: 300,
  timeRemaining: 300,
  lastUpdated: Date.now()
};

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json(electionState);
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
        return res.status(200).json({ success: true, candidates: electionState.candidates });
      }
    }

    if (body && (body.candidates || body.status)) {
      if (body.candidates) electionState.candidates = body.candidates;
      if (body.status) electionState.status = body.status;
      if (body.totalDuration !== undefined) electionState.totalDuration = body.totalDuration;
      if (body.timeRemaining !== undefined) electionState.timeRemaining = body.timeRemaining;
      return res.status(200).json({ success: true, state: electionState });
    }
  }

  return res.status(200).json(electionState);
};
