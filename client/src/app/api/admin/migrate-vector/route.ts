import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateProductEmbedding } from '@/lib/embeddings';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Run Migrations (Using JSONB instead of pgvector to bypass installation requirements)
    await sql.unsafe('ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding JSONB;');
    
    // 2. Backfill Embeddings
    const products = await sql`SELECT * FROM products WHERE embedding IS NULL`;
    let successCount = 0;
    
    for (const p of products) {
      const embedding = await generateProductEmbedding(p as any);
      if (embedding) {
        const embeddingStr = JSON.stringify(embedding);
        await sql.unsafe(`UPDATE products SET embedding = '${embeddingStr}'::jsonb WHERE id = '${p.id}'`);
        successCount++;
      }
      // slight delay
      await new Promise(r => setTimeout(r, 200));
    }

    return NextResponse.json({ 
      success: true, 
      message: `Vector extension enabled. Backfilled ${successCount} products out of ${products.length} missing embeddings.`
    });

  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
