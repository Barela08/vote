import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { dbEndElection } from '@/lib/db';

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const election = await dbEndElection();
    return NextResponse.json({ success: true, election });
  } catch (error: any) {
    console.error('End election error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
