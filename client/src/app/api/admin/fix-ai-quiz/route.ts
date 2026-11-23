import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ error: 'Use scripts/backfill-morphology.mjs to audit missing morphology.' }, { status: 410 });
}
