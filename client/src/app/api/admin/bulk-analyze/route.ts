import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return a slick HTML UI that auto-loops!
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Nyvara Bulk AI Analysis</title>
      <style>
        body { font-family: system-ui; background: #111; color: #fff; padding: 40px; max-width: 800px; margin: auto; }
        .log-box { background: #000; border: 1px solid #333; padding: 20px; border-radius: 8px; height: 500px; overflow-y: auto; font-family: monospace; }
        .log-entry { margin-bottom: 8px; border-bottom: 1px solid #222; padding-bottom: 8px; }
        .success { color: #4ade80; }
        .error { color: #f87171; }
        .info { color: #60a5fa; }
        button { background: #fff; color: #000; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>
    </head>
    <body>
      <h1>Style & Morphologie - Bulk AI</h1>
      <p>This will automatically analyze your oldest products one by one using Gemini 3.6 Flash.</p>
      <button id="startBtn" onclick="startProcess()">Start Processing</button>
      <br><br>
      <div class="log-box" id="logBox">Waiting to start...</div>

      <script>
        const secret = "${secret}";
        let isRunning = false;

        function log(msg, type = 'info') {
          const box = document.getElementById('logBox');
          if (box.innerHTML === 'Waiting to start...') box.innerHTML = '';
          box.innerHTML += '<div class="log-entry ' + type + '">' + msg + '</div>';
          box.scrollTop = box.scrollHeight;
        }

        async function startProcess() {
          if (isRunning) return;
          isRunning = true;
          document.getElementById('startBtn').disabled = true;
          
          log('Fetching list of products that need analysis...', 'info');

          try {
            while (true) {
              const res = await fetch('/api/admin/bulk-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret })
              });
              
              const data = await res.json();
              
              if (data.done) {
                log('🎉 All products have been analyzed!', 'success');
                break;
              }

              if (data.error) {
                log('Error: ' + data.error, 'error');
                break;
              }

              const p = data.product;
              log('Analyzed: <b>' + p.title + '</b><br>Shape: ' + p.frame_shape + ' | Vibe: ' + p.style_vibe, 'success');
              
              // Google Free Tier limits us to 15 requests per minute (1 every 4 seconds)
              log('<i>Waiting 4.5 seconds to respect Google free tier limits...</i>', 'info');
              await new Promise(r => setTimeout(r, 4500));
            }
          } catch(e) {
            log('Critical Error: ' + e.message, 'error');
          }
          isRunning = false;
          document.getElementById('startBtn').disabled = false;
        }
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.secret !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API key missing from environment variables' }, { status: 500 });
    }

    // Grab exactly ONE product, oldest first (ORDER BY created_at ASC)
    const productsToUpdate = await sql`
      SELECT id, title, image_url, category_id 
      FROM products 
      WHERE frame_shape IS NULL 
        AND image_url IS NOT NULL 
      ORDER BY created_at ASC
      LIMIT 1
    `;

    if (productsToUpdate.length === 0) {
      return NextResponse.json({ done: true });
    }

    const product = productsToUpdate[0];

    if (!product.image_url || !product.image_url.startsWith('http')) {
       // mark as skipped so we don't infinitely loop on it
       await sql`UPDATE products SET frame_shape = 'SKIPPED' WHERE id = ${product.id}`;
       return NextResponse.json({ product: { title: product.title, frame_shape: 'SKIPPED (Invalid URL)' } });
    }

    let rawBase64 = '';
    const imgRes = await fetch(product.image_url);
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { responseMimeType: 'application/json' },
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: rawBase64 } }
          ]
        }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google API Error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(content);
    
    await sql`
      UPDATE products 
      SET 
        frame_shape = ${parsed.frame_shape || null},
        style_vibe = ${parsed.style_vibe || null},
        optical_fit = ${parsed.optical_fit || null},
        ideal_faces = ${parsed.ideal_faces || null}
      WHERE id = ${product.id}
    `;

    return NextResponse.json({ 
      product: { 
        title: product.title || 'Produit', 
        frame_shape: parsed.frame_shape, 
        style_vibe: parsed.style_vibe 
      } 
    });

  } catch (error: any) {
    console.error('Bulk analyze failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
