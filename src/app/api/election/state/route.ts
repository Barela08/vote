import { NextResponse } from 'next/server';
import { dbGetElectionState } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/auth';
import { getOrCreateVoterIdentifier, VOTER_ID_COOKIE_NAME } from '@/lib/voterId';
import { Candidate } from '@/lib/types';

export async function GET() {
  try {
    const isAdmin = await isAdminAuthenticated();
    const { voterId, isNew } = await getOrCreateVoterIdentifier();

    const { election, candidates: rawCandidates, votes, hasVoted } = await dbGetElectionState(voterId);

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

    const response = NextResponse.json({
      election,
      candidates,
      totalVotes,
      isAdmin,
      hasVoted,
      winnerCandidate,
      tieCandidates,
    });

    if (isNew) {
      response.cookies.set({
        name: VOTER_ID_COOKIE_NAME,
        value: voterId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year persistent cookie
      });
    }

    return response;
  } catch (error) {
    console.error('Election state error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve election state' },
      { status: 500 }
    );
  }
}
