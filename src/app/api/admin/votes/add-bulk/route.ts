import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getAdminSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidate_id, count } = body;

    const voteCount = parseInt(count, 10);
    if (!candidate_id || isNaN(voteCount) || voteCount <= 0 || voteCount > 1000) {
      return NextResponse.json(
        { success: false, message: 'Invalid candidate_id or count (1-1000)' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Verify candidate exists and is active
    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single();

    if (candErr || !candidate || !candidate.is_active) {
      return NextResponse.json(
        { success: false, message: 'Candidate not found or inactive' },
        { status: 404 }
      );
    }

    // Prepare bulk vote records
    const now = new Date().toISOString();
    const voteRecords = Array.from({ length: voteCount }).map((_, index) => ({
      election_id: candidate.election_id,
      candidate_id: candidate.id,
      voter_identifier: `admin_bulk_${Date.now()}_${index}`,
      vote_type: 'ADMIN' as const,
      created_at: now,
    }));

    // Batch insert into votes table
    const { error: insertErr } = await supabase.from('votes').insert(voteRecords);

    if (insertErr) {
      console.error('Bulk vote insert error:', insertErr);
      return NextResponse.json(
        { success: false, message: 'Failed to record official admin votes' },
        { status: 500 }
      );
    }

    // Record audit log entry
    await supabase.from('audit_logs').insert({
      admin_id: 'admin',
      action: 'ADD_OFFICIAL_VOTES',
      entity_type: 'CANDIDATE',
      entity_id: candidate.id,
      metadata: {
        count: voteCount,
        candidate_name: candidate.name,
        candidate_party: candidate.party,
        timestamp: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully added ${voteCount} official votes for ${candidate.name}`,
    });
  } catch (error: any) {
    console.error('Bulk vote error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
