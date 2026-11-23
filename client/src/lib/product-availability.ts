import type { ColorOption, Product, QuantityBreak } from '../types';

type ProductAvailability = Pick<Product, 'stock' | 'is_active' | 'allow_unlimited_stock'>;

function readArray(value: unknown): unknown[] {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}

// Existing records can hold either a JSON array or its serialized form.
export function getProductColors(value: unknown): ColorOption[] {
  return readArray(value).filter((color): color is ColorOption => {
    const id = (color as Partial<ColorOption> | null)?.id;
    return typeof id === 'string' && id.length > 0;
  });
}

export function getQuantityBreaks(value: unknown): QuantityBreak[] {
  return readArray(value) as QuantityBreak[];
}

export function isProductOutOfStock(product: ProductAvailability, colors: ColorOption[]) {
  return product.is_active === false
    || ((product.stock ?? 0) <= 0 && product.allow_unlimited_stock !== true)
    || (colors.length > 0 && colors.every(color => color.isAvailable === false));
}

export function getImageColors(src: string | null, mainImage: string | null, colors: ColorOption[]) {
  if (!src) return [];
  // Image 1 inherits the main image when blank. Shared URLs keep all associations.
  return colors.filter(color => (color.image_url || mainImage) === src || color.image_url2 === src);
}

export function isColorImageSoldOut(colors: ColorOption[]) {
  return colors.length > 0 && colors.every(color => color.isAvailable === false);
}

export function getProductThumbnail(mainImage: string | null, colors: ColorOption[], soldOut: boolean) {
  const mainOwners = getImageColors(mainImage, mainImage, colors);
  if (soldOut || (mainImage && !mainOwners.some(color => color.isAvailable === false))) {
    return mainImage;
  }

  // A replacement must be a distinct Image 1 without a competing sold-out association.
  return colors.find(color => color.isAvailable !== false && color.image_url
    && color.image_url !== mainImage
    && getImageColors(color.image_url, mainImage, colors).every(owner => owner.isAvailable !== false)
  )?.image_url ?? null;
}

export function getProductGallery(mainImage: string | null, colors: ColorOption[], extraImages: string[]) {
  return [...new Set([
    mainImage,
    ...colors.flatMap(color => [color.image_url, color.image_url2]),
    ...extraImages,
  ].filter((src): src is string => Boolean(src)))];
}

export function getColorPhoto(color: ColorOption, mainImage: string | null) {
  return color.image_url || mainImage || color.image_url2 || null;
}

export function getPurchasableColor(colors: ColorOption[], id: unknown) {
  return colors.find(color => color.id === id && color.isAvailable !== false);
}

export function validatePurchase(
  product: ProductAvailability & { color_options?: unknown },
  selections: { quantity: number; colorId?: unknown }[],
) {
  const colors = getProductColors(product.color_options);
  const quantity = selections.reduce((total, selection) => total + selection.quantity, 0);
  if (isProductOutOfStock(product, colors)
    || (product.allow_unlimited_stock !== true && quantity > (product.stock ?? 0))) {
    return 'stock';
  }
  if (selections.some(({ colorId }) => colors.length
    ? !getPurchasableColor(colors, colorId)
    : colorId != null
  )) {
    return 'color';
  }
  return null;
}
