-- Migration Script to upgrade database schema for Online RPG v4
-- Add stats (fuerza, destreza, magia, salud, carisma, inteligencia) and skills (jsonb) to characters and players tables.

ALTER TABLE characters ADD COLUMN IF NOT EXISTS fuerza INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS destreza INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS magia INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS salud INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS carisma INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS inteligencia INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS skills JSONB;

ALTER TABLE players ADD COLUMN IF NOT EXISTS fuerza INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS destreza INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS magia INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS salud INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS carisma INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS inteligencia INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS skills JSONB;
