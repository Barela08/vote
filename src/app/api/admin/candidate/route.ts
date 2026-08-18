import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getAdminSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, party, photo_url, election_id } = body;

    if (!name || !party || !photo_url) {
      return NextResponse.json(
        { success: false, message: 'Name, party, and photo_url are required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Get active election if election_id not explicitly provided
    let targetElectionId = election_id;
    if (!targetElectionId) {
      const { data: elections } = await supabase
        .from('elections')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

      if (elections && elections.length > 0) {
        targetElectionId = elections[0].id;
      } else {
        // Create initial default election
        const { data: newElection } = await supabase
          .from('elections')
          .insert({ title: 'VotePro Main Election', status: 'NOT_STARTED' })
          .select('id')
          .single();
        if (newElection) targetElectionId = newElection.id;
      }
    }

    const { data: candidate, error } = await supabase
      .from('candidates')
      .insert({
        election_id: targetElectionId,
        name: name.trim(),
        party: party.trim(),
        photo_url,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Candidate insert error:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_id: 'admin',
      action: 'ADD_CANDIDATE',
      entity_type: 'CANDIDATE',
      entity_id: candidate.id,
      metadata: { name: candidate.name, party: candidate.party },
    });

    return NextResponse.json({ success: true, candidate });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, party, photo_url } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Candidate ID is required' }, { status: 400 });
    }

    const supabase = getAdminSupabaseClient();
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name) updatePayload.name = name.trim();
    if (party) updatePayload.party = party.trim();
    if (photo_url) updatePayload.photo_url = photo_url;

    const { data: candidate, error } = await supabase
      .from('candidates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_id: 'admin',
      action: 'EDIT_CANDIDATE',
      entity_type: 'CANDIDATE',
      entity_id: id,
      metadata: updatePayload,
    });

    return NextResponse.json({ success: true, candidate });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Candidate ID is required' }, { status: 400 });
    }

    const supabase = getAdminSupabaseClient();

    // Deactivate candidate so it cannot receive votes and is excluded from active list
    const { error } = await supabase
      .from('candidates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_id: 'admin',
      action: 'DELETE_CANDIDATE',
      entity_type: 'CANDIDATE',
      entity_id: id,
      metadata: { deleted_at: new Date().toISOString() },
    });

    return NextResponse.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
