-- Migration Script to upgrade database schema for Online RPG v6
-- Enforce that a character cannot be in two active campaigns at once.

CREATE OR REPLACE FUNCTION check_character_active_campaign()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.character_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM players p
    JOIN rooms r ON p.room_id = r.id
    WHERE p.character_id = NEW.character_id
      AND r.status != 'finished'
      AND (TG_OP = 'INSERT' OR p.id != NEW.id)
  ) THEN
    RAISE EXCEPTION 'Character is already in an active campaign';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists to allow re-runs of the script
DROP TRIGGER IF EXISTS enforce_character_active_campaign ON players;

CREATE TRIGGER enforce_character_active_campaign
BEFORE INSERT OR UPDATE ON players
FOR EACH ROW
EXECUTE FUNCTION check_character_active_campaign();
