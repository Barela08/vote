import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getAdminSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { durationSeconds } = body;

    const seconds = parseInt(durationSeconds, 10);
    if (isNaN(seconds) || seconds <= 0) {
      return NextResponse.json(
        { success: false, message: 'Valid duration in seconds is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Check for existing election
    const { data: existingElections } = await supabase
      .from('elections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    const now = new Date();
    const startAt = now.toISOString();
    const endAt = new Date(now.getTime() + seconds * 1000).toISOString();

    let election;

    if (existingElections && existingElections.length > 0) {
      const current = existingElections[0];
      const { data: updated, error } = await supabase
        .from('elections')
        .update({
          status: 'ACTIVE',
          start_at: startAt,
          end_at: endAt,
          winner_id: null,
          updated_at: startAt,
        })
        .eq('id', current.id)
        .select()
        .single();

      if (error) throw error;
      election = updated;
    } else {
      const { data: created, error } = await supabase
        .from('elections')
        .insert({
          title: 'VotePro Official Election',
          status: 'ACTIVE',
          start_at: startAt,
          end_at: endAt,
        })
        .select()
        .single();

      if (error) throw error;
      election = created;
    }

    // Record in Audit Log
    await supabase.from('audit_logs').insert({
      admin_id: 'admin',
      action: 'START_ELECTION',
      entity_type: 'ELECTION',
      entity_id: election.id,
      metadata: { durationSeconds: seconds, start_at: startAt, end_at: endAt },
    });

    return NextResponse.json({
      success: true,
      message: 'Voting started successfully',
      election,
    });
  } catch (error: any) {
    console.error('Start election error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
