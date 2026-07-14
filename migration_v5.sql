-- Migration Script to upgrade database schema for Online RPG v5
-- Add turn_mode to rooms table to support free-play and turn-based combat phases.

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS turn_mode VARCHAR(50) DEFAULT 'free' NOT NULL;
