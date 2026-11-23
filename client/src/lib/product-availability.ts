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

export function getColorsAvailableFirst(colors: ColorOption[]) {
  return [
    ...colors.filter(color => color.isAvailable !== false),
    ...colors.filter(color => color.isAvailable === false),
  ];
}

export function getAvailablePrimaryPhoto(mainImage: string | null, colors: ColorOption[]) {
  for (const color of colors) {
    const src = color.image_url || mainImage;
    if (src && getPurchasableColor(colors, color.id)
      && getImageColors(src, mainImage, colors).every(owner => owner.isAvailable !== false)) {
      return { src, color };
    }
  }
}

export function getProductThumbnail(mainImage: string | null, colors: ColorOption[], soldOut: boolean) {
  const mainOwners = getImageColors(mainImage, mainImage, colors);
  if (soldOut || (mainImage && !mainOwners.some(color => color.isAvailable === false))) {
    return mainImage;
  }

  return getAvailablePrimaryPhoto(mainImage, colors)?.src ?? null;
}

export function getProductGallery(
  mainImage: string | null,
  colors: ColorOption[],
  extraImages: string[],
  soldOut = colors.every(color => color.isAvailable === false),
) {
  const orderedColors = getColorsAvailableFirst(colors);
  const prioritized: string[] = [];
  const deferred: string[] = [];
  for (const color of orderedColors) {
    for (const src of [color.image_url || mainImage, color.image_url2]) {
      if (!src) continue;
      // Show shared photos once, after photos that clearly represent available colors.
      const sharedWithUnavailable = getImageColors(src, mainImage, colors).some(owner => owner.isAvailable === false);
      if (color.isAvailable !== false && sharedWithUnavailable) deferred.push(src);
      else prioritized.push(src);
    }
  }
  return [...new Set([
    soldOut ? mainImage : null,
    ...prioritized,
    ...deferred,
    mainImage,
    ...extraImages,
  ].filter((src): src is string => Boolean(src)))];
}

export function getColorPhoto(color: ColorOption, mainImage: string | null) {
  return color.image_url || mainImage || color.image_url2 || null;
}

export function getPurchasableColor(colors: ColorOption[], id: unknown) {
  const matches = colors.filter(color => color.id === id);
  return matches.length === 1 && matches[0].isAvailable !== false ? matches[0] : undefined;
}

export function isSelectedColorUnavailable(colors: ColorOption[], id: unknown) {
  return colors.length > 0 ? !getPurchasableColor(colors, id) : id != null;
}

export function unavailableColorMessage(name?: string) {
  return name
    ? `Le coloris ${name} n'est plus disponible. Veuillez choisir un autre coloris.`
    : 'Veuillez choisir un coloris disponible pour cet article.';
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
  if (selections.some(({ colorId }) => isSelectedColorUnavailable(colors, colorId))) {
    return 'color';
  }
  return null;
}
