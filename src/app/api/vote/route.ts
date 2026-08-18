import { NextResponse } from 'next/server';
import { dbCastPublicVote } from '@/lib/db';

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

    const voterId = voter_identifier || `voter_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const vote = await dbCastPublicVote(candidate_id, voterId);

    return NextResponse.json({
      success: true,
      message: 'Vote submitted successfully',
      vote,
    });
  } catch (error: any) {
    console.error('Vote submission error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server error processing vote' },
      { status: 400 }
    );
  }
}
