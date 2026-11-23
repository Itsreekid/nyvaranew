import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ error: 'Use scripts/backfill-morphology.mjs for dry-run or approved backfill.' }, { status: 410 });
}

export const POST = GET;
