import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { getAdminSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No image file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `candidate_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const supabase = getAdminSupabaseClient();

    // Upload to candidate-photos bucket
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('candidate-photos')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.warn('Supabase storage upload failed, converting to data URL fallback:', uploadErr);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;
      return NextResponse.json({ success: true, photo_url: dataUrl });
    }

    const { data: publicUrlData } = supabase.storage
      .from('candidate-photos')
      .getPublicUrl(uploadData.path);

    return NextResponse.json({
      success: true,
      photo_url: publicUrlData.publicUrl,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
