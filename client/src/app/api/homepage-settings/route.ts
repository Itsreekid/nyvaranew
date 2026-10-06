import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getHomepageSettings } from '@/lib/homepage-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getHomepageSettings();
    return NextResponse.json(settings);
  } catch (err: any) {
    console.error('[API /homepage-settings] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      hero_badge,
      hero_title,
      hero_subtitle,
      hero_stat1_value,
      hero_stat1_label,
      hero_stat2_value,
      hero_stat2_label,
      hero_stat3_value,
      hero_stat3_label,
      hero_cta1_label,
      hero_cta2_label,
      hero_image_url,
      hero_image_badge,
    } = body;

    const rows = await sql.unsafe(`
      UPDATE homepage_settings
      SET 
        hero_badge = $1,
        hero_title = $2,
        hero_subtitle = $3,
        hero_stat1_value = $4,
        hero_stat1_label = $5,
        hero_stat2_value = $6,
        hero_stat2_label = $7,
        hero_stat3_value = $8,
        hero_stat3_label = $9,
        hero_cta1_label = $10,
        hero_cta2_label = $11,
        hero_image_url = $12,
        hero_image_badge = $13,
        updated_at = now()
      WHERE id = 1
      RETURNING *
    `, [
      hero_badge,
      hero_title,
      hero_subtitle,
      hero_stat1_value,
      hero_stat1_label,
      hero_stat2_value,
      hero_stat2_label,
      hero_stat3_value,
      hero_stat3_label,
      hero_cta1_label,
      hero_cta2_label,
      hero_image_url,
      hero_image_badge,
    ]);

    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error('[API /homepage-settings PUT] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
