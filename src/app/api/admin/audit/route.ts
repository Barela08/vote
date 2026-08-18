import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { dbGetAuditLogs } from '@/lib/db';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const auditLogs = await dbGetAuditLogs();
    return NextResponse.json({ success: true, auditLogs });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
