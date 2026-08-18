import { NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { Candidate, Election } from '@/lib/types';

export async function GET() {
  try {
    const isAdmin = await isAdminAuthenticated();
    const supabase = getAdminSupabaseClient();

    // Fetch latest active or most recent election
    const { data: elections, error: electionErr } = await supabase
      .from('elections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (electionErr) {
      console.error('Error fetching election:', electionErr);
    }

    let election: Election | null = elections && elections.length > 0 ? elections[0] : null;

    // Check if active election has expired according to server timestamp
    if (election && election.status === 'ACTIVE' && election.end_at) {
      const now = new Date();
      const endAt = new Date(election.end_at);
      if (now >= endAt) {
        // Update election status to ENDED
        election.status = 'ENDED';
        await supabase
          .from('elections')
          .update({ status: 'ENDED', updated_at: now.toISOString() })
          .eq('id', election.id);
      }
    }

    if (!election) {
      return NextResponse.json({
        election: null,
        candidates: [],
        totalVotes: 0,
        isAdmin,
      });
    }

    // Fetch candidates
    const { data: candidatesData, error: candidateErr } = await supabase
      .from('candidates')
      .select('*')
      .eq('election_id', election.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (candidateErr) {
      console.error('Error fetching candidates:', candidateErr);
    }

    const rawCandidates: Candidate[] = candidatesData || [];

    // Fetch votes for this election
    const { data: votesData, error: votesErr } = await supabase
      .from('votes')
      .select('candidate_id')
      .eq('election_id', election.id);

    if (votesErr) {
      console.error('Error fetching votes:', votesErr);
    }

    const votes = votesData || [];
    const totalVotes = votes.length;

    // Count votes per candidate
    const voteCounts: Record<string, number> = {};
    rawCandidates.forEach((c) => {
      voteCounts[c.id] = 0;
    });
    votes.forEach((v) => {
      if (voteCounts[v.candidate_id] !== undefined) {
        voteCounts[v.candidate_id]++;
      }
    });

    // Map candidate list
    const candidates = rawCandidates.map((c) => ({
      ...c,
      vote_count: isAdmin ? voteCounts[c.id] || 0 : undefined,
    }));

    // If election is ENDED, determine winner or tie
    let tieCandidates: Candidate[] | undefined = undefined;
    let winnerCandidate: Candidate | null = null;

    if (election.status === 'ENDED' && rawCandidates.length > 0) {
      let maxVotes = -1;
      let topCandidates: Candidate[] = [];

      rawCandidates.forEach((c) => {
        const count = voteCounts[c.id] || 0;
        const candidateObj = { ...c, vote_count: count };
        if (count > maxVotes) {
          maxVotes = count;
          topCandidates = [candidateObj];
        } else if (count === maxVotes) {
          topCandidates.push(candidateObj);
        }
      });

      if (topCandidates.length === 1) {
        winnerCandidate = topCandidates[0];
        if (election.winner_id !== winnerCandidate.id) {
          // Store winner in database
          await supabase
            .from('elections')
            .update({ winner_id: winnerCandidate.id, updated_at: new Date().toISOString() })
            .eq('id', election.id);
          election.winner_id = winnerCandidate.id;
        }
      } else if (topCandidates.length > 1) {
        tieCandidates = topCandidates;
      }
    }

    return NextResponse.json({
      election,
      candidates,
      totalVotes,
      isAdmin,
      winnerCandidate,
      tieCandidates,
    });
  } catch (error) {
    console.error('Election state error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve election state' },
      { status: 500 }
    );
  }
}
