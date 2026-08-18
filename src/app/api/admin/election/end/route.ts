import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getAdminSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminSupabaseClient();
    const { data: elections } = await supabase
      .from('elections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!elections || elections.length === 0) {
      return NextResponse.json({ success: false, message: 'No election found' }, { status: 404 });
    }

    const current = elections[0];
    const now = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('elections')
      .update({
        status: 'ENDED',
        updated_at: now,
      })
      .eq('id', current.id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      admin_id: 'admin',
      action: 'END_ELECTION',
      entity_type: 'ELECTION',
      entity_id: current.id,
      metadata: { ended_at: now, manual: true },
    });

    return NextResponse.json({ success: true, election: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
