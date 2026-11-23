-- Optional homepage presentation settings. Existing categories default to automatic visibility.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS homepage_config jsonb;
