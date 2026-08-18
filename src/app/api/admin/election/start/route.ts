import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { dbStartElection } from '@/lib/db';

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

    const election = await dbStartElection(seconds);

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
