import { sql } from '@/lib/db';

let schemaReady = false;

export async function ensureHomepageSchema() {
  if (schemaReady) return;
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS homepage_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      hero_badge        TEXT DEFAULT 'NOUVELLE COLLECTION 2026',
      hero_title        TEXT DEFAULT 'Voir le monde autrement.',
      hero_subtitle     TEXT DEFAULT 'Des lunettes de luxe taillées pour les visionnaires.\nStyle. Précision. Fashion.',
      hero_stat1_value  TEXT DEFAULT '200+',
      hero_stat1_label  TEXT DEFAULT 'MODÈLES',
      hero_stat2_value  TEXT DEFAULT '100%',
      hero_stat2_label  TEXT DEFAULT 'ARTISANAL',
      hero_stat3_value  TEXT DEFAULT '48h',
      hero_stat3_label  TEXT DEFAULT 'LIVRAISON',
      hero_cta1_label   TEXT DEFAULT 'DÉCOUVRIR',
      hero_cta2_label   TEXT DEFAULT 'EXPLORER LA COLLECTION',
      hero_image_url    TEXT,
      hero_image_badge  TEXT DEFAULT 'COLLECTION EXCLUSIVE 2026',
      updated_at        TIMESTAMPTZ DEFAULT now()
    );
  `);
  await sql.unsafe(`
    ALTER TABLE homepage_settings
      ADD COLUMN IF NOT EXISTS hero_badge        TEXT DEFAULT 'NOUVELLE COLLECTION 2026',
      ADD COLUMN IF NOT EXISTS hero_title        TEXT DEFAULT 'Voir le monde autrement.',
      ADD COLUMN IF NOT EXISTS hero_subtitle     TEXT DEFAULT 'Des lunettes de luxe taillées pour les visionnaires.\nStyle. Précision. Fashion.',
      ADD COLUMN IF NOT EXISTS hero_stat1_value  TEXT DEFAULT '200+',
      ADD COLUMN IF NOT EXISTS hero_stat1_label  TEXT DEFAULT 'MODÈLES',
      ADD COLUMN IF NOT EXISTS hero_stat2_value  TEXT DEFAULT '100%',
      ADD COLUMN IF NOT EXISTS hero_stat2_label  TEXT DEFAULT 'ARTISANAL',
      ADD COLUMN IF NOT EXISTS hero_stat3_value  TEXT DEFAULT '48h',
      ADD COLUMN IF NOT EXISTS hero_stat3_label  TEXT DEFAULT 'LIVRAISON',
      ADD COLUMN IF NOT EXISTS hero_cta1_label   TEXT DEFAULT 'DÉCOUVRIR',
      ADD COLUMN IF NOT EXISTS hero_cta2_label   TEXT DEFAULT 'EXPLORER LA COLLECTION',
      ADD COLUMN IF NOT EXISTS hero_image_url    TEXT,
      ADD COLUMN IF NOT EXISTS hero_image_badge  TEXT DEFAULT 'COLLECTION EXCLUSIVE 2026',
      ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT now();
  `);
  await sql.unsafe(`INSERT INTO homepage_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  schemaReady = true;
}

export async function getHomepageSettings() {
  await ensureHomepageSchema();
  const rows = await sql.unsafe(`SELECT * FROM homepage_settings WHERE id = 1`);
  return rows[0] ?? {};
}
