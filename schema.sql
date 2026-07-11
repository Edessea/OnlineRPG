-- Supabase Database Schema for Online RPG v2

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
  description TEXT, -- Biography/Equipment
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  fuerza INTEGER,
  destreza INTEGER,
  magia INTEGER,
  salud INTEGER,
  carisma INTEGER,
  inteligencia INTEGER,
  skills JSONB
);

-- 3. Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE, -- User-friendly short room code (e.g. ABCDE)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  status VARCHAR(20) DEFAULT 'lobby' NOT NULL, -- 'lobby', 'playing', 'finished'
  gm_context TEXT DEFAULT '' NOT NULL, -- Cumulative memory summary updated by GM on every turn
  active_player_id UUID, -- References players(id). NULL when in lobby or during GM turn
  current_dice_type VARCHAR(10) DEFAULT 'D20' NOT NULL, -- Dictated by GM for next action
  victory_condition TEXT,
  defeat_condition TEXT,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  name VARCHAR(255)
);

-- 4. Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  session_id VARCHAR(255), -- Persisted client cookie/localStorage session (legacy)
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  race VARCHAR(50) NOT NULL,
  class VARCHAR(50) NOT NULL,
  description TEXT, -- Biography/Equipment
  stats JSONB DEFAULT '{"HP": 100, "Level": 1, "XP": 0}'::jsonb NOT NULL,
  join_order INT NOT NULL, -- Determined sequentially as players register (0, 1, 2...)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  fuerza INTEGER,
  destreza INTEGER,
  magia INTEGER,
  salud INTEGER,
  carisma INTEGER,
  inteligencia INTEGER,
  skills JSONB,
  UNIQUE (room_id, user_id)
);

-- 5. Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  sender_type VARCHAR(10) NOT NULL, -- 'player', 'gm', 'system'
  player_id UUID REFERENCES players(id) ON DELETE SET NULL, -- NULL if GM/System
  message_type VARCHAR(10) DEFAULT 'action' NOT NULL, -- 'action' (affects story) or 'chat' (OOC chatter)
  content TEXT NOT NULL,
  dice_roll INT, -- Dice outcome if message_type = 'action'
  image_url TEXT, -- GM generated image URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 7. Create Permissive Policies
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Public Read/Write Rooms'
  ) THEN
    CREATE POLICY "Public Read/Write Rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Public Read/Write Players'
  ) THEN
    CREATE POLICY "Public Read/Write Players" ON players FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Public Read/Write Messages'
  ) THEN
    CREATE POLICY "Public Read/Write Messages" ON messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- 8. Enable Realtime
-- If the publication supabase_realtime does not exist, create it:
-- CREATE PUBLICATION supabase_realtime;
-- ALTER PUBLICATION supabase_realtime ADD TABLE users, characters, rooms, players, messages;
