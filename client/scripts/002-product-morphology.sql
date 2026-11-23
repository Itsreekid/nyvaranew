-- Only adds columns on installations that do not already have morphology metadata.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS frame_shape text,
  ADD COLUMN IF NOT EXISTS style_vibe text,
  ADD COLUMN IF NOT EXISTS optical_fit text,
  ADD COLUMN IF NOT EXISTS ideal_faces text[];
