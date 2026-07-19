-- Migration Script to upgrade database schema for Online RPG v7
-- Add spells column to characters table.

ALTER TABLE characters ADD COLUMN IF NOT EXISTS spells JSONB DEFAULT '[]'::jsonb;
