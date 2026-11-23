const GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

export const MORPHOLOGY_PROMPT = 'Analyze the eyewear in the image. Return only a JSON object with frame_shape, style_vibe, optical_fit, and ideal_faces. Use frame_shape from Rond Classique, Aviateur, Oeil-de-chat, Carree, Rectangulaire, Geometrique, Ovale, or Demi-monture. Use style_vibe from Retro, Minimaliste, Audacieux, Chic, Sport, Elegant. Use ideal_faces as an array of Rond, Ovale, Carre, Coeur. Use optical_fit from Petit / Etroit, Moyen / Standard, Large only when reliable scale or a visible size marking supports it. Never invent exact measurements. Use null for uncertain fields or if the item is not eyewear.';

export class GeminiResponseError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;
  constructor(status: number, retryAfter: string | null) {
    super('Google API error ' + status);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const supportedImages = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const maxImageBytes = 12 * 1024 * 1024;

export async function fetchProductImage(imageUrl: string) {
  const url = new URL(imageUrl);
  const allowed = new Set(['assets.nyvara.com', 'pub-96ecbfcde03642529999eddf062d31f5.r2.dev', 'vkrgfqjsixjsieqzykcx.supabase.co']);
  if (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL) {
    allowed.add(new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL).host);
  }
  if (url.protocol !== 'https:' || !allowed.has(url.host) || url.username || url.password) {
    throw new Error('Unsupported product image URL');
  }
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  const mimeType = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!response.ok || !supportedImages.has(mimeType) || Number(response.headers.get('content-length')) > maxImageBytes) {
    throw new Error('Product image unavailable or unsupported');
  }
  const image = Buffer.from(await response.arrayBuffer());
  if (!image.length || image.length > maxImageBytes) throw new Error('Invalid product image size');
  return { data: image.toString('base64'), mimeType };
}

export function readInlineImage(value: string) {
  const match = /^data:(image\/[\w-]+);base64,/.exec(value);
  const mimeType = match?.[1] ?? 'image/jpeg';
  const data = match ? value.slice(match[0].length) : value;
  if (!supportedImages.has(mimeType) || !data || data.length > maxImageBytes * 4 / 3 + 4
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Invalid inline product image');
  return { data, mimeType };
}

export async function requestGeminiImage(image: { data: string; mimeType: string }, prompt: string, apiKey: string) {
  const response = await fetch(GOOGLE_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      generationConfig: { responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: image }] }],
    }),
  });
  if (!response.ok) throw new GeminiResponseError(response.status, response.headers.get('retry-after'));
  const data = await response.json();
  const content: unknown = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== 'string') throw new Error('Gemini returned no analysis');
  const result: unknown = JSON.parse(content.replace(/^\s*```(?:json)?|\`\`\`\s*$/gi, '').trim());
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Gemini returned invalid analysis');
  return result;
}
