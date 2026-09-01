import type { Product } from '@/types';

export async function generateProductEmbedding(product: Partial<Product>): Promise<number[] | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    console.error('[embeddings] OPENROUTER_API_KEY not set.');
    return null;
  }

  // Build a rich text representation of the product for the embedding model
  const parts = [
    product.title || '',
    product.description || '',
    product.features || '',
    product.gender ? `Gender: ${product.gender}` : '',
  ];

  if (product.specs) {
    const specsStr = Object.entries(product.specs)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    parts.push(specsStr);
  }

  const textToEmbed = parts.filter(p => p.trim() !== '').join('\n');

  try {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/text-embedding-3-small',
        input: textToEmbed,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[embeddings] OpenRouter API error:', res.status, errorText);
      return null;
    }

    const data = await res.json();
    if (data && data.data && data.data[0] && data.data[0].embedding) {
      return data.data[0].embedding;
    }

    return null;
  } catch (error) {
    console.error('[embeddings] Failed to fetch embedding:', error);
    return null;
  }
}
