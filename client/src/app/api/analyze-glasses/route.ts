import { NextRequest, NextResponse } from 'next/server';
import { fetchProductImage, GeminiResponseError, readInlineImage, requestGeminiImage } from '@/lib/gemini-image';
import { normalizeMorphology } from '@/lib/morphology';

const buildSystemPrompt = () => {
  return `You are an expert stylist and senior e-commerce copywriter for Nyvara, a premium Tunisian brand. Analyze the provided image of a product and return STRICT valid JSON — no Markdown fences, no extra keys, no commentary outside the JSON object.

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
  "highlights_bullets": "Ligne 1\nLigne 2\nLigne 3\nLigne 4",
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
  "frame_shape": "Rond Classique",
  "style_vibe": "Retro",
  "optical_fit": null,
  "ideal_faces": ["Rond", "Oval"]
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
- technical_specs: EXACTLY 6 entries as { key, value } objects describing the item's visible features in French. Never invent exact measurements or unverified materials.
- style_vibe: MUST BE ONE OF: Retro | Minimaliste | Audacieux | Chic | Sport | Elegant
- color_analysis.secondary_hex: null if the item is uniform in color.
- frame_shape: IF THE PRODUCT IS EYEWEAR/GLASSES, MUST BE ONE OF: Rond Classique | Aviateur | Oeil-de-chat | Carree | Rectangulaire | Geometrique (otherwise null)
- optical_fit: IF THE PRODUCT IS EYEWEAR/GLASSES, use Petit / Etroit | Moyen / Standard | Large only when reliable scale or a visible size marking supports it. Otherwise return null. Never infer physical frame width from a photo without scale.
- ideal_faces: IF THE PRODUCT IS EYEWEAR/GLASSES, array from: Rond | Oval | Carre | Coeur (otherwise null)
- Output ONLY the JSON object. No prefix, no suffix, no markdown.`;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: 'Google API key is missing' }, { status: 500 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 }); }
  if (typeof body?.imageBase64 !== 'string' && typeof body?.imageUrl !== 'string') {
    return NextResponse.json({ success: false, error: 'No imageBase64 or imageUrl provided.' }, { status: 400 });
  }
  try {
    const image = typeof body.imageBase64 === 'string' ? readInlineImage(body.imageBase64) : await fetchProductImage(body.imageUrl);
    const data = await requestGeminiImage(image, buildSystemPrompt(), apiKey);
    return NextResponse.json({ success: true, data: { ...data, ...normalizeMorphology(data) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ success: false, error: message }, {
      status: error instanceof GeminiResponseError && error.status === 429 ? 429 : 502,
    });
  }
}
