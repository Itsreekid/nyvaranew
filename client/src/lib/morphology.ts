export const FRAME_LABELS = { round: 'Rond classique', aviator: 'Aviateur', cat_eye: 'Œil-de-chat', square: 'Carrée', rectangle: 'Rectangulaire', geometric: 'Géométrique', oval: 'Ovale', semi_rimless: 'Demi-monture' } as const;
export const STYLE_LABELS = { retro: 'Rétro', minimalist: 'Minimaliste', bold: 'Audacieux', chic: 'Chic', sport: 'Sport', elegant: 'Élégant' } as const;
export const FIT_LABELS = { small: 'Petit / Étroit', medium: 'Moyen / Standard', large: 'Large' } as const;
export const MORPHOLOGY_NOT_SPECIFIED = 'not_specified';
export const FACE_LABELS = { round: 'Rond', oval: 'Ovale', square: 'Carré', heart: 'Cœur' } as const;

function key(value: unknown) {
  return typeof value === 'string'
    ? value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe')
      .replace(/[^a-z0-9]+/g, ' ').trim()
    : '';
}

function lookup<T extends string>(value: unknown, labels: Record<T, string>, aliases: Record<string, T> = {}): T | null {
  const token = key(value);
  return (Object.hasOwn(aliases, token) ? aliases[token] : undefined)
    ?? (Object.keys(labels) as T[]).find(id => key(id) === token || key(labels[id]) === token) ?? null;
}

export const normalizeFrameShape = (value: unknown) => lookup(value, FRAME_LABELS, {
  rond: 'round', carre: 'square',
});
const normalizeFit = (value: unknown) => lookup(value, FIT_LABELS, {
  petit: 'small', etroit: 'small', moyen: 'medium', grand: 'large', 'grand large': 'large',
});

function readFaces(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(readFaces);
  if (typeof value !== 'string') return [];
  if (value.trimStart().startsWith('[')) {
    try { return readFaces(JSON.parse(value)); } catch { return []; }
  }
  return value.replace(/^\{|\}$/g, '').split(/[,;|/]/);
}

export function normalizeMorphology(input: unknown) {
  const value = (input && typeof input === 'object' ? input : {}) as {
    frame_shape?: unknown; style_vibe?: unknown; optical_fit?: unknown; ideal_faces?: unknown;
  };
  const faces = readFaces(value.ideal_faces).map(face => lookup(face, FACE_LABELS)).filter(face => face !== null);
  return {
    frame_shape: normalizeFrameShape(value.frame_shape),
    style_vibe: lookup(value.style_vibe, STYLE_LABELS),
    optical_fit: normalizeFit(value.optical_fit),
    ideal_faces: [...new Set(faces)],
  };
}

export function isEyewear(product: { title?: string | null; categories?: { name?: string | null } | null; frame_shape?: unknown }) {
  const identity = key((product.categories?.name ?? '') + ' ' + (product.title ?? ''));
  if (/\b(lunettes?|eyewear|sunglasses|montures?|optique)\b/.test(identity)) return true;
  if (/\b(montres?|watches?|bagues?|bijoux|bracelets?|gadgets?)\b/.test(identity)) return false;
  return normalizeFrameShape(product.frame_shape) !== null;
}
