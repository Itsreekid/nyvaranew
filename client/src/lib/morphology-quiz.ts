import { isEyewear, normalizeMorphology } from './morphology';
import { getProductColors, isProductOutOfStock } from './product-availability';
import type { Product } from '../types';

const faceFrames = {
  round: ['rectangle', 'square', 'semi_rimless'],
  square: ['round', 'oval', 'aviator'],
  oval: ['square', 'rectangle', 'geometric'],
  heart: ['aviator', 'round', 'cat_eye'],
};
const styleFrames = {
  angular: ['rectangle', 'square', 'geometric', 'semi_rimless'],
  soft: ['round', 'oval', 'aviator'],
};
const styleVibes = { angular: ['bold'], soft: ['retro'] };

export function parseMorphologyQuiz(token: string | null) {
  const [gender, face, style, size, extra] = token?.split(',') ?? [];
  if (extra !== undefined || (gender !== 'homme' && gender !== 'femme')
    || (face !== 'round' && face !== 'square' && face !== 'oval' && face !== 'heart')
    || (style !== 'angular' && style !== 'soft' && style !== 'all')
    || (size !== 'small' && size !== 'medium' && size !== 'large')) return null;
  return { gender, face, style, size } as const;
}

export function rankMorphologyProducts(products: Product[], quiz: NonNullable<ReturnType<typeof parseMorphologyQuiz>>) {
  return products.filter(product => product.is_active !== false && isEyewear(product)).map(product => {
    const metadata = normalizeMorphology(product);
    const unavailable = isProductOutOfStock(product, getProductColors(product.color_options));
    let score = metadata.ideal_faces.includes(quiz.face) ? 8 : 0;
    if (metadata.frame_shape && faceFrames[quiz.face].includes(metadata.frame_shape)) score += 3;
    if (quiz.style !== 'all') {
      if (metadata.frame_shape && styleFrames[quiz.style].includes(metadata.frame_shape)) score += 4;
      // Minimalist, chic, elegant and sport are shape-neutral.
      if (metadata.style_vibe && styleVibes[quiz.style].includes(metadata.style_vibe)) score += 1;
    }
    if (metadata.optical_fit === quiz.size) score += 3;
    return { product, unavailable, score };
  }).sort((a, b) => Number(a.unavailable) - Number(b.unavailable) || b.score - a.score).map(entry => entry.product);
}
