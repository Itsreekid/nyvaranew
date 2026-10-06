import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      UPDATE products 
      SET 
        frame_shape = 'Non spécifié',
        style_vibe = 'Standard',
        optical_fit = 'Standard',
        ideal_faces = ARRAY['Tous']::text[]
      WHERE frame_shape IS NULL OR style_vibe IS NULL;
    `;

    return NextResponse.json({ 
      success: true, 
      message: "Anciens produits mis à jour avec succès !", 
      updated_rows: result.count 
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
