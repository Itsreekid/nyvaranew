-- Apply before deploying the checkout code. Existing/manual orders can have no variant ID.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_color_id text;
