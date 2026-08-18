import { NextResponse } from 'next/server';
import { dbGetElectionState } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/auth';
import { Candidate } from '@/lib/types';

export async function GET() {
  try {
    const isAdmin = await isAdminAuthenticated();
    const { election, candidates: rawCandidates, votes } = await dbGetElectionState();

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

    // Map candidates list (only include vote_count for admin)
    const candidates = rawCandidates.map((c) => ({
      ...c,
      vote_count: isAdmin ? voteCounts[c.id] || 0 : undefined,
    }));

    // If election is ENDED, calculate winner or tie
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
        election.winner_id = winnerCandidate.id;
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
