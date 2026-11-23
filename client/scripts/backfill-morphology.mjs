// Node 24+. Audit: node scripts/backfill-morphology.mjs
// Sample without writes: node scripts/backfill-morphology.mjs --analyze --limit 5
// Approved write: node scripts/backfill-morphology.mjs --write --after <last-id>
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import postgres from 'postgres';
import { isEyewear, MORPHOLOGY_NOT_SPECIFIED, normalizeMorphology } from '../src/lib/morphology.ts';
import { fetchProductImage, GeminiResponseError, MORPHOLOGY_PROMPT, requestGeminiImage } from '../src/lib/gemini-image.ts';

const { values: options } = parseArgs({
  options: {
    'dry-run': { type: 'boolean' },
    analyze: { type: 'boolean' },
    write: { type: 'boolean' },
    limit: { type: 'string' },
    after: { type: 'string' },
  },
});
const analyze = options.analyze || options.write;
const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.GEMINI_API_KEY;
const limit = Number(options.limit ?? Number.MAX_SAFE_INTEGER);
const validUuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
if (!databaseUrl || (analyze && !apiKey) || (options.write && options['dry-run'])
  || !Number.isSafeInteger(limit) || limit < 1 || (options.after && !validUuid.test(options.after))) {
  throw new Error('Provide DATABASE_URL, GEMINI_API_KEY for analysis, and valid options. --dry-run and --write are mutually exclusive.');
}

const fields = ['frame_shape', 'style_vibe', 'optical_fit', 'ideal_faces'];
const sql = postgres(databaseUrl, {
  max: 1,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
const counts = { inspected: 0, needsEnrichment: 0, successful: 0, skipped: 0, failed: 0, uncertain: 0 };
let cursor = options.after ?? null;

function missing(value, field) {
  return field === 'ideal_faces' ? !value.length : !value;
}

function fillable(field, value) {
  if (value == null || value === '') return true;
  // These are placeholders written by the retired automatic repair, not trusted values.
  if (field === 'ideal_faces') return Array.isArray(value) && value.length === 1 && value[0] === 'Tous';
  return ['non spécifié', 'skipped', 'null', 'undefined', 'standard'].includes(String(value).trim().toLowerCase());
}

function log(product, status, details = {}) {
  console.log(JSON.stringify({ id: product.id, title: product.title, status, ...details }));
}

async function suggest(product) {
  const image = await fetchProductImage(product.image_url);
  for (let attempt = 0; ; attempt++) {
    try {
      return normalizeMorphology(await requestGeminiImage(image, MORPHOLOGY_PROMPT, apiKey));
    } catch (error) {
      if (!(error instanceof GeminiResponseError) || (error.status !== 429 && error.status < 500) || attempt === 3) throw error;
      const seconds = Number(error.retryAfter);
      const retryAfter = Number.isFinite(seconds) && seconds > 0
        ? seconds * 1000 : Date.parse(error.retryAfter ?? '') - Date.now();
      const wait = Math.max(4500 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter : 0);
      if (wait > 60000) throw error;
      await delay(wait);
    }
  }
}

async function inspect(product) {
  if (!isEyewear(product)) { counts.skipped++; log(product, 'skipped', { reason: 'not eyewear' }); return; }
  const current = normalizeMorphology(product);
  const absent = fields.filter(field => missing(current[field], field)
    && product[field] !== MORPHOLOGY_NOT_SPECIFIED
    && !(field === 'ideal_faces' && Array.isArray(product[field]) && product[field].length === 0));
  if (!absent.length) { counts.skipped++; log(product, 'skipped', { reason: 'complete or deliberately unspecified' }); return; }
  counts.needsEnrichment++;
  const candidates = absent.filter(field => fillable(field, product[field]));
  if (!product.image_url || !candidates.length) {
    counts.uncertain++; log(product, 'uncertain', { absent, reason: 'missing image or protected legacy values' }); return;
  }
  if (!analyze) { log(product, 'needs-enrichment', { absent, fillable: candidates }); return; }

  try {
    const proposal = await suggest(product);
    const suggested = current.frame_shape || proposal.frame_shape
      ? candidates.filter(field => !missing(proposal[field], field))
      : [];
    if (!suggested.length) {
      counts.uncertain++; log(product, 'uncertain', { absent, reason: 'Gemini had no reliable values' }); return;
    }
    let applied = suggested;
    if (options.write) {
      applied = await sql.begin(async tx => {
        const [locked] = await tx`SELECT image_url, frame_shape, style_vibe, optical_fit, ideal_faces FROM products WHERE id = ${product.id} FOR UPDATE`;
        if (!locked || locked.image_url !== product.image_url) return [];
        const safe = suggested.filter(field => fillable(field, locked[field])
          && JSON.stringify(locked[field]) === JSON.stringify(product[field]));
        if (safe.length) {
          await tx`UPDATE products SET
            frame_shape = CASE WHEN ${safe.includes('frame_shape')} THEN ${proposal.frame_shape} ELSE frame_shape END,
            style_vibe = CASE WHEN ${safe.includes('style_vibe')} THEN ${proposal.style_vibe} ELSE style_vibe END,
            optical_fit = CASE WHEN ${safe.includes('optical_fit')} THEN ${proposal.optical_fit} ELSE optical_fit END,
            ideal_faces = CASE WHEN ${safe.includes('ideal_faces')} THEN ${tx.array(proposal.ideal_faces, 25)} ELSE ideal_faces END
            WHERE id = ${product.id}`;
        }
        return safe;
      });
    }
    if (applied.length) counts.successful++;
    if (applied.length < absent.length) counts.uncertain++;
    log(product, applied.length ? options.write ? 'updated' : 'proposed' : 'uncertain', {
      values: Object.fromEntries(applied.map(field => [field, proposal[field]])),
      stillMissing: absent.filter(field => !applied.includes(field)),
    });
  } catch (error) {
    counts.failed++;
    log(product, 'failed', { error: error.message });
    if (error instanceof GeminiResponseError && [401, 403, 404, 429].includes(error.status)) throw error;
  } finally {
    await delay(4500);
  }
}

try {
  while (counts.inspected < limit) {
    const products = await sql`
      SELECT p.id, p.title, p.image_url, p.frame_shape, p.style_vibe, p.optical_fit, p.ideal_faces,
        json_build_object('name', c.name) AS categories
      FROM products p LEFT JOIN categories c ON p.category_id = c.id
      WHERE (${cursor}::uuid IS NULL OR p.id > ${cursor}::uuid)
      ORDER BY p.id LIMIT ${Math.min(25, limit - counts.inspected)}`;
    if (!products.length) break;
    for (const product of products) {
      await inspect(product);
      cursor = product.id;
      counts.inspected++;
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify({ ...counts, mode: options.write ? 'write' : analyze ? 'analyze-only' : 'audit', resumeAfter: cursor }));
  await sql.end();
}
