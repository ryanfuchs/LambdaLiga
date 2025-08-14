-- Create games table
CREATE TABLE IF NOT EXISTS games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('lobby', 'playing', 'played', 'cancelled')) DEFAULT 'lobby',
    winner TEXT CHECK (winner IN ('red', 'blue')),
    red_team_size INTEGER NOT NULL DEFAULT 1 CHECK (red_team_size IN (1, 2)),
    blue_team_size INTEGER NOT NULL DEFAULT 1 CHECK (blue_team_size IN (1, 2)),
    red_score INTEGER,
    blue_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_players table to track which players are in which games and teams
CREATE TABLE IF NOT EXISTS game_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team TEXT NOT NULL CHECK (team IN ('red', 'blue')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, player_id)
);

-- Add foreign key constraint to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'game_players_player_id_fkey' 
        AND table_name = 'game_players'
    ) THEN
        ALTER TABLE game_players 
        ADD CONSTRAINT game_players_player_id_fkey 
        FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create profiles table if it doesn't exist (for username storage)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players(player_id);
CREATE INDEX IF NOT EXISTS idx_game_players_team ON game_players(team);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default profile for existing users (if any)
INSERT INTO profiles (id, username)
SELECT id, COALESCE(raw_user_meta_data->>'username', 'Player' || substr(id::text, 1, 8))
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for games table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'games' AND policyname = 'Games are viewable by authenticated users') THEN
        CREATE POLICY "Games are viewable by authenticated users" ON games
            FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'games' AND policyname = 'Games can be created by authenticated users') THEN
        CREATE POLICY "Games can be created by authenticated users" ON games
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'games' AND policyname = 'Games can be updated by authenticated users') THEN
        CREATE POLICY "Games can be updated by authenticated users" ON games
            FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create policies for game_players table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'game_players' AND policyname = 'Game players are viewable by authenticated users') THEN
        CREATE POLICY "Game players are viewable by authenticated users" ON game_players
            FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'game_players' AND policyname = 'Game players can be created by authenticated users') THEN
        CREATE POLICY "Game players can be created by authenticated users" ON game_players
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'game_players' AND policyname = 'Game players can be updated by authenticated users') THEN
        CREATE POLICY "Game players can be updated by authenticated users" ON game_players
            FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create policies for profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles are viewable by authenticated users') THEN
        CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
            FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
        CREATE POLICY "Users can update their own profile" ON profiles
            FOR UPDATE USING (auth.uid() = id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles can be created by authenticated users') THEN
        CREATE POLICY "Profiles can be created by authenticated users" ON profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;
