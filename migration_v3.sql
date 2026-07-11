-- Migration Script to upgrade database schema for Online RPG v3
-- Add description and name to rooms table to store global campaign premise and name

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS name VARCHAR(255);
