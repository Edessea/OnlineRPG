-- Migration Script to upgrade database schema for Online RPG v2

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create characters table
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  race VARCHAR(50) NOT NULL,
  class VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Add creator_id to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 4. Add character_id and user_id to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES characters(id) ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE players ALTER COLUMN session_id DROP NOT NULL;

-- 5. Drop old unique constraint on players and replace with unique user per room
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_room_id_session_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_room_id_user_id_key'
  ) THEN
    ALTER TABLE players ADD CONSTRAINT players_room_id_user_id_key UNIQUE (room_id, user_id);
  END IF;
END
$$;

-- 6. Enable RLS and create permissive policies for new tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Public Read/Write Users'
  ) THEN
    CREATE POLICY "Public Read/Write Users" ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'characters' AND policyname = 'Public Read/Write Characters'
  ) THEN
    CREATE POLICY "Public Read/Write Characters" ON characters FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- 7. Add tables to realtime publication if needed (will do no harm if they fail, so we ignore error)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE users, characters;
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;
