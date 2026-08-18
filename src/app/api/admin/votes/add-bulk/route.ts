import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { dbAddBulkVotes } from '@/lib/db';

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

    await dbAddBulkVotes(candidate_id, voteCount);

    return NextResponse.json({
      success: true,
      message: `Successfully added ${voteCount} official votes!`,
    });
  } catch (error: any) {
    console.error('Bulk vote error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
