import { NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { candidate_id, voter_identifier } = body;

    if (!candidate_id) {
      return NextResponse.json(
        { success: false, message: 'Candidate ID is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // 1. Fetch current candidate & check active status
    const { data: candidate, error: candidateErr } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single();

    if (candidateErr || !candidate || !candidate.is_active) {
      return NextResponse.json(
        { success: false, message: 'Invalid or inactive candidate' },
        { status: 400 }
      );
    }

    // 2. Fetch associated election & verify status and time
    const { data: election, error: electionErr } = await supabase
      .from('elections')
      .select('*')
      .eq('id', candidate.election_id)
      .single();

    if (electionErr || !election) {
      return NextResponse.json(
        { success: false, message: 'Associated election not found' },
        { status: 404 }
      );
    }

    if (election.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, message: 'Voting is not active' },
        { status: 400 }
      );
    }

    const now = new Date();
    if (election.end_at && now >= new Date(election.end_at)) {
      // Auto-update status to ENDED if expired
      await supabase
        .from('elections')
        .update({ status: 'ENDED', updated_at: now.toISOString() })
        .eq('id', election.id);

      return NextResponse.json(
        { success: false, message: 'Voting has ended' },
        { status: 400 }
      );
    }

    // 3. Register vote in database
    const voterId = voter_identifier || `voter_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const { data: newVote, error: voteInsertErr } = await supabase
      .from('votes')
      .insert({
        election_id: election.id,
        candidate_id: candidate.id,
        voter_identifier: voterId,
        vote_type: 'PUBLIC',
      })
      .select()
      .single();

    if (voteInsertErr) {
      console.error('Error inserting vote:', voteInsertErr);
      return NextResponse.json(
        { success: false, message: 'Failed to record vote' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully voted for ${candidate.name}`,
      vote: newVote,
    });
  } catch (error) {
    console.error('Vote submission error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error processing vote' },
      { status: 500 }
    );
  }
}
