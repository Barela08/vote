import { NextResponse } from 'next/server';
import { dbCastPublicVote } from '@/lib/db';
import { getOrCreateVoterIdentifier, VOTER_ID_COOKIE_NAME } from '@/lib/voterId';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { candidate_id } = body;

    if (!candidate_id) {
      return NextResponse.json(
        { success: false, message: 'Candidate ID is required' },
        { status: 400 }
      );
    }

    const { voterId, isNew } = await getOrCreateVoterIdentifier();

    try {
      const vote = await dbCastPublicVote(candidate_id, voterId);

      const response = NextResponse.json({
        success: true,
        message: 'Vote submitted successfully',
        vote,
      });

      if (isNew) {
        response.cookies.set({
          name: VOTER_ID_COOKIE_NAME,
          value: voterId,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
        });
      }

      return response;
    } catch (err: any) {
      const msg = err.message || 'Server error processing vote';
      return NextResponse.json(
        {
          success: false,
          hasVoted: msg.includes('already voted'),
          message: msg,
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Vote submission error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error processing vote' },
      { status: 500 }
    );
  }
}
