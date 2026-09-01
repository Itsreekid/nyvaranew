import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key missing from environment variables' }, { status: 500 });
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
    const errors: string[] = [];

    for (const product of productsToUpdate) {
      if (!product.image_url || !product.image_url.startsWith('http')) {
        errors.push(`Product ${product.id} skipped: invalid image_url (must start with http)`);
        continue;
      }

      let rawBase64 = '';
      try {
        const imgRes = await fetch(product.image_url);
        const arrayBuffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
      } catch (err: any) {
        errors.push(`Product ${product.id} image fetch failed: ${err.message}`);
        continue;
      }

      const prompt = `You are a fashion AI. Analyze this product image. Return STRICT JSON.
      {
        "frame_shape": "Rond Classique | Aviateur | Oeil-de-chat | Carree | Rectangulaire | Geometrique",
        "style_vibe": "Retro | Minimaliste | Audacieux | Chic | Sport | Elegant",
        "optical_fit": "Petit / Etroit | Moyen / Standard | Large",
        "ideal_faces": ["Rond", "Oval", "Carre", "Coeur"]
      }
      ONLY return the JSON object. No Markdown.`;

      const res = await fetch(GOOGLE_API_URL + apiKey, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationConfig: {
            responseMimeType: 'application/json'
          },
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: rawBase64
                }
              }
            ]
          }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        let content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
        } catch (parseErr: any) {
          errors.push(`Product ${product.id} parsing failed: ${parseErr.message} (Raw: ${content.substring(0, 50)})`);
        }
      } else {
        const errText = await res.text();
        errors.push(`Product ${product.id} Google API Error ${res.status}: ${errText}`);
      }
      
      // small delay to prevent rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully analyzed and updated ${successCount} products.`,
      debug_errors: errors
    });

  } catch (error: any) {
    console.error('Bulk analyze failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
