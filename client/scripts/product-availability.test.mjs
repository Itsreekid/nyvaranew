import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as availability from '../src/lib/product-availability.ts';

const {
  getColorsAvailableFirst, getColorPhoto, getImageColors, getProductColors, getProductGallery,
  getProductThumbnail, isColorImageSoldOut, isProductOutOfStock, validatePurchase,
} = availability;

const main = '/main.png';
const first = { id: 'transparent', name: 'Transparent et Noir', hex1: '#ccc', image_url: '', isAvailable: false };
const second = { id: 'black', name: 'Noir Classique', hex1: '#000', image_url: '/black.png', image_url2: '/black-side.png' };
const third = { id: 'brown', name: 'Brun', hex1: '#532', image_url: '/brown.png' };
const inStock = { is_active: true, stock: 3 };

test('thumbnail honors Image 1, fallback ownership, reactivation and admin order', () => {
  assert.equal(getProductThumbnail(main, [first, second, third], false), second.image_url);
  assert.equal(getProductThumbnail(main, [first, third, second], false), third.image_url);
  assert.equal(getProductThumbnail(main, [{ ...first, isAvailable: true }, second], false), main);
  assert.equal(getProductThumbnail(main, [], false), main);
  assert.equal(getProductThumbnail(null, [second], false), second.image_url);
  assert.equal(getProductThumbnail(null, [], false), null);
  assert.equal(getProductThumbnail(main, [first], true), main);
  assert.equal(getProductThumbnail(main, [first, { ...second, image_url: '' }], false), null);
  assert.equal(getProductThumbnail(main, [first, { ...second, image_url: '', image_url2: '/new.png' }, third], false), third.image_url);
});

test('gallery retains inactive photos, deduplicates URLs and labels only confirmed stockouts', () => {
  const colors = getProductColors(JSON.stringify([first, second, third]));
  assert.deepEqual(getColorsAvailableFirst(colors).map(color => color.id), [second.id, third.id, first.id]);
  assert.deepEqual(getProductGallery(main, colors, [main, '/extra.png']), [
    '/black.png', '/black-side.png', '/brown.png', main, '/extra.png',
  ]);
  assert.deepEqual(getProductGallery(main, [first], ['/extra.png']), [main, '/extra.png']);
  assert.deepEqual(getProductGallery(main, [], ['/extra.png']), [main, '/extra.png']);
  assert.equal(getColorPhoto(first, main), main);
  assert.equal(getColorPhoto(second, main), second.image_url);
  assert.equal(getColorPhoto({ ...second, image_url: '' }, null), second.image_url2);
  assert.equal(isColorImageSoldOut(getImageColors(main, main, colors)), true);
  assert.equal(isColorImageSoldOut(getImageColors(second.image_url2, main, colors)), false);
  assert.equal(isColorImageSoldOut(getImageColors('/extra.png', main, colors)), false);
  const shared = [first, { ...second, image_url: main }];
  assert.equal(isColorImageSoldOut(getImageColors(main, main, shared)), false);
  assert.equal(getProductThumbnail(main, shared, false), null);
  assert.deepEqual(getProductGallery(main, shared, []), ['/black-side.png', main]);
  assert.deepEqual(getProductGallery(main, [first, second], [], true), [main, '/black.png', '/black-side.png']);
});

test('purchase validation checks color IDs, aggregate quantity and unlimited stock', () => {
  const product = { ...inStock, color_options: [first, second, third] };
  assert.equal(validatePurchase(product, [{ quantity: 1, colorId: first.id }]), 'color');
  assert.equal(validatePurchase(product, [{ quantity: 1, colorId: 'deleted' }]), 'color');
  assert.equal(validatePurchase({ ...product, color_options: [second, { ...third, id: second.id }] },
    [{ quantity: 1, colorId: second.id }]), 'color');
  assert.equal(validatePurchase(product, [{ quantity: 1 }]), 'color');
  assert.equal(validatePurchase(product, [{ quantity: 2, colorId: second.id }, { quantity: 2, colorId: third.id }]), 'stock');
  assert.equal(validatePurchase(product, [{ quantity: 2, colorId: second.id }, { quantity: 1, colorId: third.id }]), null);
  assert.equal(validatePurchase(inStock, [{ quantity: 1 }]), null);
  assert.equal(validatePurchase({ ...product, allow_unlimited_stock: true }, [{ quantity: 8, colorId: second.id }]), null);
  assert.equal(validatePurchase({ ...product, allow_unlimited_stock: true }, [{ quantity: 8, colorId: first.id }]), 'color');
  assert.equal(isProductOutOfStock({ ...inStock, allow_unlimited_stock: true }, [first]), true);
  assert.equal(isProductOutOfStock({ stock: 0, allow_unlimited_stock: true }, [second]), false);
  assert.equal(isProductOutOfStock({ ...inStock, is_active: false }, [second]), true);
});

test('Meta XML and CSV use the first safe Image 1, advertise its variant, and separate stock from copy', async () => {
  const source = await readFile(new URL('../src/lib/meta-catalog.ts', import.meta.url), 'utf8');
  const js = stripTypeScriptTypes(source, { mode: 'strip' }).replace(/^import .*$/gm, '').replace(/^export /gm, '');
  const { buildMetaCatalogXmlItem: xml, buildMetaCatalogCsvRow: csv } = runInNewContext(
    js + '\n({ buildMetaCatalogXmlItem, buildMetaCatalogCsvRow })',
    { ...availability, normalizeProductImageUrl: value => value ?? '', URL },
  );
  const product = {
    id: 'product', image_url: main, stock: 0, allow_unlimited_stock: true,
    title: 'Lunettes Noir Classique — RUPTURE DE STOCK',
    description: 'Monture légère\nColoris Transparent et Noir — Indisponible\nVoir le coloris Noir Classique',
    badge: 'Épuisé',
    price: 50,
    color_options: [first, second, third],
  };
  for (const entry of [xml(product), csv(product)]) {
    assert.match(entry, /\/shop\/product\?color=black/);
    assert.match(entry, /https:\/\/nyvara.net\/black.png/);
    assert.match(entry, /in stock/);
    assert.match(entry, /Lunettes Noir Classique/);
    assert.match(entry, /Monture légère/);
    assert.doesNotMatch(entry, /rupture de stock|épuisé|indisponible|voir le coloris|\/main.png/i);
  }
  assert.match(xml(product), /<g:image_link>https:\/\/nyvara.net\/black.png<\/g:image_link>/);
  assert.match(xml({ ...product, color_options: [{ ...first, isAvailable: true }, second] }), /color=transparent/);
  assert.match(xml({ ...product, color_options: [first] }), /<g:availability>out of stock<\/g:availability>/);
  assert.match(xml({ ...product, allow_unlimited_stock: false }), /<g:availability>out of stock<\/g:availability>/);
  assert.equal(xml({ ...product, color_options: [first, { ...second, image_url: '' }] }), '');
  assert.match(xml({ ...product, color_options: [] }), /<g:image_link>https:\/\/nyvara.net\/main.png<\/g:image_link>/);
});

async function loadPost(route, sql) {
  const source = await readFile(new URL(route, import.meta.url), 'utf8');
  // Load the actual handler body with stand-ins for Next.js and PostgreSQL.
  const js = stripTypeScriptTypes(source, { mode: 'strip' })
    .replace(/^import .*$/gm, '')
    .replace(/^export /gm, '');
  return runInNewContext(js + '\nPOST', {
    ...availability,
    sql,
    console,
    NextResponse: { json: (body, { status } = {}) => ({ body, status: status ?? 200 }) },
  });
}

test('cart POST rejects a stale color and accepts it after reactivation', async () => {
  let product = { ...inStock, color_options: [first, second] };
  const handler = await loadPost('../src/app/api/products/[id]/route.ts', async () => [product]);
  const request = { json: async () => [{ quantity: 1, colorId: first.id }] };
  const context = { params: Promise.resolve({ id: 'product' }) };
  const rejected = await handler(request, context);
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.issue, 'color');
  product = { ...product, color_options: [{ ...first, isAvailable: true }, second] };
  assert.equal((await handler(request, context)).status, 200);
});

test('checkout checks current colors before inserting and saves canonical color metadata', async () => {
  const statements = [];
  const product = { ...inStock, id: 'product', title: 'Lunettes', price: 50, color_options: [first, second] };
  const sql = { begin: run => run(async (parts, ...values) => {
    const query = parts.join('?');
    statements.push({ query, values });
    return query.includes('FROM products') ? [product] : [{ id: 'order' }];
  }) };
  const handler = await loadPost('../src/app/api/orders/route.ts', sql);
  const order = selected_color => ({
    json: async () => ({ items: [{ product_id: product.id, quantity: 1, selected_color }] }),
  });
  const rejected = await handler(order(first));
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.error, "Le coloris Transparent et Noir n'est plus disponible. Veuillez choisir un autre coloris.");
  assert.equal(statements.length, 1);
  statements.length = 0;
  assert.equal((await handler(order({ ...second, name: 'Wrong name' }))).status, 201);
  const item = statements.find(statement => statement.query.includes('INSERT INTO order_items'));
  assert.ok(item);
  assert.equal(item.values[3], second.id);
  assert.equal(item.values[4], second.name);
  assert.match(statements[0].query, /ORDER BY id FOR UPDATE/);
  const deduction = statements.find(statement => statement.query.includes('UPDATE products'));
  assert.deepEqual(deduction.values, [1, product.id]);
});
