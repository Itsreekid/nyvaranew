import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// google/gemini-2.5-flash — multimodal vision model available on OpenRouter
const MODEL = 'google/gemini-2.5-flash';
const FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';

const buildSystemPrompt = (categoryName: string) => {
  const isGlasses = categoryName.toLowerCase().includes('lunettes') || categoryName.toLowerCase().includes('solaire');
  const catText = categoryName && categoryName !== 'Produit général' ? categoryName : 'produit (lunettes, montres, accessoires, etc.)';
  
  return `You are an expert stylist and senior e-commerce copywriter for Nyvara, a premium Tunisian brand. Analyze the provided image of a product from the category "${catText}" and return STRICT valid JSON — no Markdown fences, no extra keys, no commentary outside the JSON object.

Required schema (return ALL fields, use null if not applicable to this product category):
{
  "name_suggestions": ["Nom reel axe sur le design", "Nom creatif", "Nom modele elegant"],
  "price_original": 89.900,
  "price_discounted": 69.900,
  "cost_price": 25.000,
  "stock_initial": 15,
  "gender": "unisex",
  "promo_badge": "Offre Speciale",
  "rating_score": 4.8,
  "rating_count": 42,
  "highlights_bullets": "Ligne 1\\nLigne 2\\nLigne 3\\nLigne 4",
  "full_description": "2 paragraphes marketing detaillant le style, le confort et les finitions.",
  "product_type": "Type du produit (ex: lunettes_solaires, montre, bague, etc.)",
  "color_analysis": {
    "variant_name": "Couleur principale",
    "primary_hex": "#000000",
    "secondary_hex": "#FFFFFF"
  },
  "technical_specs": [
    { "key": "Caractéristique 1", "value": "Valeur" },
    { "key": "Caractéristique 2", "value": "Valeur" },
    { "key": "Caractéristique 3", "value": "Valeur" },
    { "key": "Caractéristique 4", "value": "Valeur" },
    { "key": "Caractéristique 5", "value": "Valeur" },
    { "key": "Caractéristique 6", "value": "Valeur" }
  ],
  "frame_shape": ${isGlasses ? '"Rond Classique"' : 'null'},
  "style_vibe": "Retro",
  "optical_fit": ${isGlasses ? '"Moyen / Standard"' : 'null'},
  "ideal_faces": ${isGlasses ? '["Rond", "Oval"]' : 'null'}
}

Rules:
- name_suggestions: EXACTLY 3 distinct titles in FRENCH based on visible traits.
- price_original: realistic TND price between 49.900 and 249.900. price_discounted must be lower. cost_price = roughly 25-35% of price_original.
- stock_initial: realistic integer between 10 and 30.
- gender: must be exactly "unisex", "homme", or "femme".
- promo_badge: SHORT string max 30 chars IN FRENCH.
- rating_score: float between 4.2 and 4.9. rating_count: integer between 20 and 200.
- highlights_bullets: exactly 4 lines IN FRENCH separated by newline.
- full_description: 2 French marketing paragraphs.
- technical_specs: EXACTLY 6 entries as { key, value } objects describing the item (e.g. materials, dimensions, features). All in French.
- style_vibe: MUST BE ONE OF: Retro | Minimaliste | Audacieux | Chic | Sport | Elegant
- color_analysis.secondary_hex: null if the item is uniform in color.
${isGlasses ? `- frame_shape: MUST BE ONE OF: Rond Classique | Aviateur | Oeil-de-chat | Carree | Rectangulaire | Geometrique
- optical_fit: MUST BE ONE OF: Petit / Etroit | Moyen / Standard | Large
- ideal_faces: array from: Rond | Oval | Carre | Coeur` : `- frame_shape: return null
- optical_fit: return null
- ideal_faces: return null`}
- Output ONLY the JSON object. No prefix, no suffix, no markdown.`;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'OpenRouter API key is missing' }, { status: 500 });
  }

  let imageBase64: string | undefined;
  let imageUrl: string | undefined;
  let categoryName = 'Produit général';

  try {
    const body = await req.json();
    imageBase64 = body?.imageBase64;
    imageUrl = body?.imageUrl;
    if (body?.categoryName) categoryName = body.categoryName;
  } catch (err: unknown) {
    console.error('[analyze-glasses] JSON parse error:', err);
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!imageBase64 && !imageUrl) {
    return NextResponse.json({ success: false, error: 'No imageBase64 or imageUrl provided.' }, { status: 400 });
  }

  const imageContent = imageBase64
    ? { type: 'image_url', image_url: { url: imageBase64 } }
    : { type: 'image_url', image_url: { url: imageUrl } };

  const systemPrompt = buildSystemPrompt(categoryName);

  const tryWithModel = async (model: string) => {
    return await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://nyvara.tn',
        'X-Title': 'Nyvara Admin Panel',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
          { role: 'user', content: [imageContent] },
        ],
      }),
    });
  };

  try {
    let orRes = await tryWithModel(MODEL);

    if (!orRes.ok) {
      console.warn(`[analyze-glasses] Primary model ${MODEL} failed (${orRes.status}), trying fallback...`);
      orRes = await tryWithModel(FALLBACK_MODEL);
    }

    if (!orRes.ok) {
      const errText = await orRes.text();
      console.error('[analyze-glasses] Both models failed:', orRes.status, errText);
      return NextResponse.json(
        { success: false, error: `AI service returned ${orRes.status}. Please try again.` },
        { status: 502 }
      );
    }

    const orData = await orRes.json();
    const rawContent: string = orData?.choices?.[0]?.message?.content ?? '';

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : rawContent;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseErr) {
      console.error('[analyze-glasses] JSON parse error:', parseErr, '\nRaw:', rawContent.slice(0, 500));
      return NextResponse.json(
        { success: false, error: 'AI returned malformed JSON. Try uploading the image again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[analyze-glasses] Unexpected error:', message);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}