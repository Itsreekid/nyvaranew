import type { Product } from '@/types';
import { normalizeProductImageUrl } from '@/lib/r2';
import { getAvailablePrimaryPhoto, getImageColors, getProductColors, isProductOutOfStock } from '@/lib/product-availability';

export const DEFAULT_GOOGLE_PRODUCT_CATEGORY =
  'Apparel & Accessories > Clothing Accessories > Sunglasses';

export const DEFAULT_BRAND = 'Nyvara';

export type MetaCatalogProduct = Pick<
  Product,
  | 'id'
  | 'title'
  | 'description'
  | 'price'
  | 'final_price'
  | 'discount'
  | 'stock'
  | 'is_active'
  | 'allow_unlimited_stock'
  | 'image_url'
  | 'gender'
  | 'badge'
  | 'brand'
  | 'google_product_category'
  | 'color_options'
> & {
  categories?: Product['categories'] | { name: string | null }[] | null;
  custom_label_0?: string | null;
};

export function formatMetaPrice(price: number | string | null | undefined): string {
  return `${Number(price ?? 0).toFixed(2)} TND`;
}

export function isProductOnSale(product: {
  price: number | string | null;
  final_price: number | string | null;
  discount?: number | string | null;
}): boolean {
  const price = Number(product.price ?? 0);
  const finalPrice = Number(product.final_price ?? 0);
  if (finalPrice > 0 && price > 0 && finalPrice < price) {
    return true;
  }
  return Number(product.discount ?? 0) > 0;
}

export function getProductPricing(product: {
  price: number | string | null;
  final_price: number | string | null;
  discount?: number | string | null;
}): { regularPrice: number; salePrice: number; onSale: boolean } {
  // postgres.js returns NUMERIC columns as strings — coerce to number defensively
  const regularPrice = Number(product.price ?? product.final_price ?? 0);
  const salePrice = Number(product.final_price ?? product.price ?? 0);
  const onSale = isProductOnSale(product);
  return { regularPrice, salePrice, onSale };
}

const SITE_URL = 'https://nyvara.net';

function catalogImageUrl(value: string | null | undefined): string {
  const normalized = normalizeProductImageUrl(value?.trim());
  if (!/^(?:https?:\/\/|\/[^/])/i.test(normalized)) return '';
  try {
    const url = new URL(normalized, SITE_URL);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function getCatalogPresentation(product: MetaCatalogProduct, galleryUrls: string[]) {
  const mainImage = catalogImageUrl(product.image_url) || null;
  const colors = getProductColors(product.color_options).map(color => ({
    ...color,
    image_url: catalogImageUrl(color.image_url),
    image_url2: catalogImageUrl(color.image_url2),
  }));
  const soldOut = isProductOutOfStock(product, colors);
  const photo = soldOut ? undefined : getAvailablePrimaryPhoto(mainImage, colors);
  const mainOwners = getImageColors(mainImage, mainImage, colors);
  const primary = soldOut
    ? mainImage || colors.find(color => color.image_url)?.image_url
    : photo?.src || (mainOwners.length === 0 ? mainImage : null);
  // An entry needs a product photo. Skip it if the only primary images are unsafe.
  if (!primary) return null;

  const link = new URL('/shop/' + encodeURIComponent(product.id), SITE_URL);
  if (photo) link.searchParams.set('color', photo.color.id);
  const additionalImages = [...new Set([
    ...colors.flatMap(color => [color.image_url, color.image_url2]),
    ...galleryUrls.map(catalogImageUrl),
  ])].filter(src => {
    if (!src || src === primary || soldOut) return false;
    const owners = getImageColors(src, mainImage, colors);
    return colors.length === 0 || (owners.length > 0 && owners.every(owner => owner.isAvailable !== false));
  }).slice(0, 10);

  return { primary, link: link.href, availability: soldOut ? 'out of stock' : 'in stock', additionalImages };
}

function cleanCatalogCopy(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/coloris[ \t]+[^—–|\r\n]+[—–][ \t]*indisponible/giu, '')
    .replace(/voir le coloris(?:[ \t]+[^—–|;\r\n]+)?/giu, '')
    .replace(/(?<![\p{L}])(?:rupture de stock|épuisé|indisponible)(?![\p{L}])/giu, '')
    .replace(/(?:[ \t]*[—–|][ \t]*)+$/gmu, '')
    .replace(/^[ \t]*[—–|][ \t]*/gmu, '')
    .trim();
}

function escXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapGender(gender: MetaCatalogProduct['gender']): string {
  if (gender === 'homme') return 'male';
  if (gender === 'femme') return 'female';
  if (gender === 'enfant') return 'unisex'; // Meta/Google doesn't have a kids value for accessories
  return 'unisex';
}

export function buildMetaCatalogXmlItem(
  product: MetaCatalogProduct,
  options?: { galleryUrls?: string[]; indent?: string }
): string {
  const indent = options?.indent ?? '    ';
  const { regularPrice, salePrice, onSale } = getProductPricing(product);
  const catalog = getCatalogPresentation(product, options?.galleryUrls ?? []);
  if (!catalog) return '';
  const title = escXml(cleanCatalogCopy(product.title) || 'Nyvara Sunglasses');
  const description = escXml(cleanCatalogCopy(product.description) || 'Lunettes de soleil de luxe — Nyvara Tunisia');
  const link = escXml(catalog.link);
  const imageLink = escXml(catalog.primary);
  const { availability, additionalImages } = catalog;
  const brand = escXml(product.brand ?? DEFAULT_BRAND);
  const googleCategory = escXml(product.google_product_category ?? DEFAULT_GOOGLE_PRODUCT_CATEGORY);
  const categoryName = Array.isArray(product.categories)
    ? product.categories[0]?.name
    : product.categories?.name;
  const productType = escXml(categoryName ?? 'sunglasses');
  const gender = mapGender(product.gender);

  const priceBlock = onSale
    ? `<g:price>${formatMetaPrice(regularPrice)}</g:price>
${indent}  <g:sale_price>${formatMetaPrice(salePrice)}</g:sale_price>`
    : `<g:price>${formatMetaPrice(salePrice)}</g:price>`;

  let customLabels = '';
  const labels = [cleanCatalogCopy(product.custom_label_0), cleanCatalogCopy(product.badge)].filter(Boolean);
  for (const [index, label] of labels.entries()) {
    customLabels += `\n${indent}  <g:custom_label_${index}>${escXml(label)}</g:custom_label_${index}>`;
  }
  let additionalImagesXml = '';
  if (additionalImages.length > 0) {
    additionalImagesXml = '\n' + additionalImages
      .map(url => `${indent}  <g:additional_image_link>${escXml(url)}</g:additional_image_link>`)
      .join('\n');
  }

  return `${indent}<item>
${indent}  <g:id>${product.id}</g:id>
${indent}  <g:title>${title}</g:title>
${indent}  <g:description>${description}</g:description>
${indent}  <g:link>${link}</g:link>
${indent}  <g:image_link>${imageLink}</g:image_link>${additionalImagesXml}
${indent}  <g:availability>${availability}</g:availability>
${indent}  ${priceBlock}
${indent}  <g:brand>${brand}</g:brand>
${indent}  <g:condition>new</g:condition>
${indent}  <g:google_product_category>${googleCategory}</g:google_product_category>
${indent}  <g:product_type>${productType}</g:product_type>
${indent}  <g:gender>${gender}</g:gender>${customLabels}
${indent}</item>`;
}

export function buildMetaCatalogCsvRow(product: MetaCatalogProduct, galleryUrls: string[] = []): string {
  const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const { regularPrice, salePrice, onSale } = getProductPricing(product);
  const catalog = getCatalogPresentation(product, galleryUrls);
  if (!catalog) return '';

  return [
    esc(product.id),
    esc(cleanCatalogCopy(product.title) || 'Nyvara Sunglasses'),
    esc(cleanCatalogCopy(product.description) || 'Lunettes de soleil Nyvara'),
    esc(catalog.availability),
    esc('new'),
    esc(formatMetaPrice(onSale ? regularPrice : salePrice)),
    esc(onSale ? formatMetaPrice(salePrice) : ''),
    esc(catalog.link),
    esc(catalog.primary),
    esc(catalog.additionalImages.join(',')),
    esc(product.brand ?? DEFAULT_BRAND),
    esc(product.google_product_category ?? DEFAULT_GOOGLE_PRODUCT_CATEGORY),
    esc(product.gender === 'homme' ? 'male' : product.gender === 'femme' ? 'female' : 'unisex'),
  ].join(',');
}
