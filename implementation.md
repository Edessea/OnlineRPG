# Online RPG - Revised Implementation Plan

This document outlines the step-by-step implementation plan for the text-based Online RPG where Gemini acts as the Game Master (GM). The application is built using Next.js (App Router), Vanilla CSS, and Supabase (Database & Realtime).

---

## Technical Stack & Architecture

- **Frontend/Backend:** Next.js (React, App Router, API Routes).
- **Database & Sync:** Supabase (PostgreSQL + Supabase Realtime for instant chat & game state synchronization).
- **AI Game Master:** Gemini API via the official SDK (`@google/generative-ai` or `@google/genai`).
- **Styling:** Vanilla CSS (CSS Modules) for a cozy, dark sepia aesthetic with responsive layouts.
- **State Management:** React state synchronized with Supabase Realtime subscriptions.

---

## Revised Database Schema (Supabase)

To prevent turn disruption and ensure multiplayer reliability, we utilize direct player ID tracking and state machine controls.

### 1. `rooms`
Tracks the game lobby, active playing state, and current Game Master context.
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  status VARCHAR(20) DEFAULT 'lobby' NOT NULL, -- 'lobby', 'playing', 'finished'
  gm_context TEXT DEFAULT '' NOT NULL, -- Cumulative memory summary updated by GM on every turn
  active_player_id UUID, -- References players(id). NULL when in lobby or during GM turn
  current_dice_type VARCHAR(10) DEFAULT 'D20' NOT NULL, -- Dictated by GM for next action
  victory_condition TEXT,
  defeat_condition TEXT
);
```

### 2. `players`
Tracks player profiles and character sheets.
```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  session_id VARCHAR(255) NOT NULL, -- Persisted client cookie/localStorage session
  name VARCHAR(100) NOT NULL,
  race VARCHAR(50) NOT NULL,
  class VARCHAR(50) NOT NULL,
  description TEXT, -- Biography/Equipment
  stats JSONB DEFAULT '{"HP": 100, "Level": 1, "XP": 0}'::jsonb NOT NULL,
  join_order INT NOT NULL, -- Determined sequentially as players register (0, 1, 2...)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (room_id, session_id)
);
```

### 3. `messages`
Stores the chat history, dice rolls, and GM narrations.
```sql
CREATE TABLE messages (
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
```

---

## Security & Row Level Security (RLS)

To run the application locally or in staging without complex authentication:
1. RLS will be enabled on all tables.
2. We will apply wildcard public policies allowing anyone to `SELECT`, `INSERT`, and `UPDATE` records matching their room IDs.

```sql
-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create Permissive Policies
CREATE POLICY "Public Read/Write Rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write Players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write Messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rooms, players, messages;
```

---

## Implementation Milestones

### Milestone 1: Project Setup & Database Configuration
Initialize the project workspace, verify connection to Supabase, and apply schema migrations.

#### Proposed Actions:
- Setup a Next.js (App Router, JavaScript) boilerplate.
- Install `@supabase/supabase-js` and `@google/generative-ai` SDKs.
- Create `/lib/supabaseClient.js`.
- Apply SQL migration scripts to the Supabase database.

#### **How to Test Progress:**
1. **App Compilation:** Ensure Next.js starts cleanly (`npm run dev`) and loads the default route.
2. **Database Verification:** Execute the schema SQL in the Supabase Editor. Verify that `rooms`, `players`, and `messages` tables exist and the realtime publication is active.
3. **Environment Handshake:** Run a simple client check verifying that `supabase` can communicate with your project instance without network or SSL errors.

---

### Milestone 2: Lobby Setup & Character Entry (Screens 1 & 2)
Build the user-facing home portal, lobby connection interface, and character submission screens.

#### Proposed Actions:
- **Home Screen (`app/page.js`):**
  - "Iniciar partida" generates a new room with state `status = 'lobby'` and redirects to character creation.
  - "Unirse a una partida" accepts a room ID or full URL and forwards to character creation.
- **Character Creation (`app/room/[id]/character/page.js`):**
  - Captures character details (Name, Class, Race, Biography).
  - Fetches the current player count in the room to assign sequential `join_order`.
  - Saves a unique session key in `localStorage` to check if a returning player is already registered. If they are, skip character creation and redirect straight to the game room.
- **Global Theme (`app/globals.css`):**
  - Implement a dark sepia styling using warm parchment (`#f4ecd8`), charcoal text (`#1c120c`), gold accents (`#c39b38`), and classic serif typography.

#### **How to Test Progress:**
1. **Lobby Creation:** Click "Iniciar partida" and check that you land on the character registration page with a valid UUID in the address bar.
2. **Character Persistency:** Register a character. Refresh the page. You should be automatically bypassed to the active game room.
3. **Lobby Multiplayer Check:** Copy the URL, open an incognito window, paste the URL, and register a second character. Verify that both character rows are recorded in Supabase, with `join_order = 0` and `join_order = 1` respectively.

---

### Milestone 3: Realtime Game Board & Turn Sync (Screen 3)
Build the primary splitscreen game board. Hook up Supabase Realtime so chat feeds, active turns, and player sheets sync dynamically across all screens.

#### Proposed Actions:
- **Game Layout (`app/room/[id]/page.js`):**
  - Left panel: Active player list with dynamic HP, Level, and XP stats. Highlight the player whose `id` matches `room.active_player_id`. Add a modal overlay displaying full character sheets.
  - Center panel: Messages feed. OOC Chat has a muted style; Actions display roll outputs; GM messages show high-contrast story cards.
  - Bottom panel: Form input with a toggle to choose "Acción" or "Chat".
- **Lobby Controls:**
  - If `room.status = 'lobby'`, show a "Comenzar Aventura" button for the creator (or any player) to shift status to `'playing'`. Shifting to `'playing'` sets the first player (`join_order = 0`) as `active_player_id` and fires the initialization GM narrations.
- **Realtime Integration (`lib/useRoomState.js`):**
  - Implement subscriptions to PostgreSQL inserts and updates. Whenever the backend changes, local state updates immediately.

#### **How to Test Progress:**
1. **Realtime Chat Sync:** Open two browser windows side-by-side. Type an OOC message in one. Verify it pops up in the other client in under 500ms.
2. **Turn Enforcer:** Verify that the "Acción" toggle and "Roll Dice" button are completely disabled for players whose ID does not match `room.active_player_id`. They must only be allowed to send OOC chat.
3. **Action & Roll Cycle:** Have the active player type an action and click submit. Verify the text displays in the chat while the input field locks. The player clicks "Roll Dice", which updates the action message with a random value.

---

### Milestone 4: Backend Action Handling & Gemini AI Integration
Ensure secure database updates and trigger the Gemini AI GM.

#### Proposed Actions:
- **Consolidated Action Endpoint (`app/api/room/action/route.js`):**
  - Instead of direct client DB updates, clients hit this endpoint with `{ playerId, actionText }`. The server inserts the action text, computes the dice roll, updates the database, and immediately calls Gemini.
- **Game Master Prompts (`app/api/gm/route.js`):**
  - Read `room.gm_context` (historical log summary) and the last 15 messages.
  - Call Gemini using a structured JSON parser requesting:
    - `gm_message` (story outcome description).
    - `updated_players` (array of player IDs and new HP/Level/XP stats).
    - `next_player_id` (the ID of the next player in the turn sequence).
    - `next_dice_type` (e.g. 'D20', 'D10', 'D6' depending on the scenario's danger level).
    - `is_critical_moment` (boolean to trigger image creation).
    - `image_prompt` (scenic prompt description).
    - `updated_gm_context` (revised quest summary containing new key actions).
  - Update `rooms` (`gm_context`, `active_player_id`, `current_dice_type`) and update modified `players` statistics in the database.

#### **How to Test Progress:**
1. **AI Narration Turn:** Complete a player action and roll. Verify that the GM route automatically triggers, post-evaluates the player action, and posts the narrative outcome in the chat.
2. **Turn Rotation:** Confirm that after the GM finishes typing, `room.active_player_id` updates to the next player's ID, unlocking their interface.
3. **Stat Alterations:** Verify that if the GM specifies a player loses HP, the changes reflect instantly in the players list sidebar.

---

### Milestone 5: Scenic Image Generation & End Game Loop
Implement AI image creation for key narrative checkpoints, final victory/defeat logic, and game resets.

#### Proposed Actions:
- **Async Image Generator (`app/api/image/route.js`):**
  - Triggered in the background if the GM marks `is_critical_moment = true`.
  - Connects to Imagen (or a free dev model like Pollinations AI) to create a visual backdrop.
  - Updates the GM's database message row with the image URL.
- **Campaign Wrap (`app/room/[id]/end/page.js`):**
  - Triggers when the GM updates `room.status = 'finished'`.
  - Displays a results log detailing player levels, victory status, and a "Jugar de nuevo" button to return to `/`.

#### **How to Test Progress:**
1. **Image Embedding:** Initiate an action that forces a dangerous outcome. Verify that the GM returns an inline card containing the generated scenic image.
2. **Victory/Defeat Transitions:** Force the room status to `'finished'` in the database. Verify that all connected players are immediately redirected to the Campaign Summary end page.
3. **Reset Cycle:** Press "Jugar de nuevo". Ensure you return to the home screen and can create a brand new room.
