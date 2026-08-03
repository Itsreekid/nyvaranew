import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get('nyvara_admin_session')?.value;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
    }

    const bucket = process.env.R2_BUCKET_NAME;
    const publicBase = process.env.R2_PUBLIC_URL || 'https://pub-96ecbfcde03642529999eddf062d31f5.r2.dev';

    if (!bucket) {
      return NextResponse.json({ error: 'R2_BUCKET_NAME is not configured' }, { status: 500 });
    }

    // Extract key from url
    if (!url.startsWith(publicBase)) {
        return NextResponse.json({ error: 'Invalid url for this bucket' }, { status: 400 });
    }
    const key = url.replace(publicBase + '/', '');

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await getR2Client().send(command);

    return NextResponse.json({ success: true, key });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete image';
    console.error('[delete-image] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
