import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const check = await sql`SELECT id, frame_shape, style_vibe, optical_fit, ideal_faces FROM products LIMIT 10;`;
    
    const result = await sql`
      UPDATE products 
      SET 
        frame_shape = COALESCE(NULLIF(frame_shape, ''), NULLIF(frame_shape, 'null'), 'Non spécifié'),
        style_vibe = COALESCE(NULLIF(style_vibe, ''), NULLIF(style_vibe, 'null'), 'Standard'),
        optical_fit = COALESCE(NULLIF(optical_fit, ''), NULLIF(optical_fit, 'null'), 'Standard'),
        ideal_faces = COALESCE(ideal_faces, ARRAY['Tous']::text[])
      WHERE 
        frame_shape IS NULL OR frame_shape = '' OR frame_shape = 'null' OR frame_shape = 'undefined' OR
        style_vibe IS NULL OR style_vibe = '' OR style_vibe = 'null' OR style_vibe = 'undefined' OR
        optical_fit IS NULL OR optical_fit = '' OR
        ideal_faces IS NULL;
    `;

    return NextResponse.json({ 
      success: true, 
      message: "Anciens produits mis à jour avec succès !", 
      updated_rows: result.count,
      sample_data: check
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}