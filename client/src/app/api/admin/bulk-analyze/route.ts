import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenRouter API key missing' }, { status: 500 });
  }

  try {
    // Grab up to 10 products that are missing frame_shape (to prevent Vercel timeouts)
    const productsToUpdate = await sql`
      SELECT id, title, image_url, category_id 
      FROM products 
      WHERE frame_shape IS NULL 
        AND image_url IS NOT NULL 
      LIMIT 10
    `;

    if (productsToUpdate.length === 0) {
      return NextResponse.json({ success: true, message: 'All products have been successfully upgraded! 0 remaining.' });
    }

    let successCount = 0;

    for (const product of productsToUpdate) {
      // Build standard prompt asking only for the morphological fields
      const prompt = `You are a fashion AI. Analyze this product image. Return STRICT JSON.
      {
        "frame_shape": "Rond Classique | Aviateur | Oeil-de-chat | Carree | Rectangulaire | Geometrique",
        "style_vibe": "Retro | Minimaliste | Audacieux | Chic | Sport | Elegant",
        "optical_fit": "Petit / Etroit | Moyen / Standard | Large",
        "ideal_faces": ["Rond", "Oval", "Carre", "Coeur"]
      }
      ONLY return the JSON object. No Markdown.`;

      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: product.image_url } }
            ]
          }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        let content = data.choices?.[0]?.message?.content || '';
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
          const parsed = JSON.parse(content);
          
          await sql`
            UPDATE products 
            SET 
              frame_shape = ${parsed.frame_shape || null},
              style_vibe = ${parsed.style_vibe || null},
              optical_fit = ${parsed.optical_fit || null},
              ideal_faces = ${parsed.ideal_faces ? JSON.stringify(parsed.ideal_faces) : null}
            WHERE id = ${product.id}
          `;
          successCount++;
        } catch (parseErr) {
          console.error('Failed to parse AI response for product', product.id, content);
        }
      }
      
      // small delay to prevent rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully analyzed and updated ${successCount} products. Please refresh this page to process the next batch of 10 products!`
    });

  } catch (error: any) {
    console.error('Bulk analyze failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
