-- Add commands column to store_items
-- Each item can define server commands to execute on purchase.
-- Use {username} as placeholder for the buyer's Minecraft username.
-- Example: ['give {username} pokemon:rare_candy 8', 'lp user {username} parent add vip']

ALTER TABLE store_items
  ADD COLUMN IF NOT EXISTS commands TEXT[] NOT NULL DEFAULT '{}';
