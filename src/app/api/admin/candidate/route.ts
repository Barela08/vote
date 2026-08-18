import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { dbAddCandidate, dbEditCandidate, dbDeleteCandidate } from '@/lib/db';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, party, photo_url } = body;

    if (!name || !party || !photo_url) {
      return NextResponse.json(
        { success: false, message: 'Name, party, and photo_url are required' },
        { status: 400 }
      );
    }

    const candidate = await dbAddCandidate(name, party, photo_url);
    return NextResponse.json({ success: true, candidate });
  } catch (error: any) {
    console.error('Add candidate error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to add candidate' }, { status: 500 });
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

    const candidate = await dbEditCandidate(id, name, party, photo_url);
    return NextResponse.json({ success: true, candidate });
  } catch (error: any) {
    console.error('Edit candidate error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to edit candidate' }, { status: 500 });
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

    await dbDeleteCandidate(id);
    return NextResponse.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error: any) {
    console.error('Delete candidate error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to delete candidate' }, { status: 500 });
  }
}
