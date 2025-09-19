-- ELO System Implementation based on Chess.com's Glicko-2 Rating System
-- This system tracks player ratings, volatility, and automatically updates after games

-- Add rating fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 1500;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating_deviation INTEGER DEFAULT 350;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS volatility DECIMAL(10,6) DEFAULT 0.06;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS draws INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_game_at TIMESTAMP WITH TIME ZONE;

-- Create rating_history table to track rating changes over time
CREATE TABLE IF NOT EXISTS rating_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    old_rating INTEGER NOT NULL,
    new_rating INTEGER NOT NULL,
    old_rating_deviation INTEGER NOT NULL,
    new_rating_deviation INTEGER NOT NULL,
    old_volatility DECIMAL(10,6) NOT NULL,
    new_volatility DECIMAL(10,6) NOT NULL,
    opponent_rating INTEGER NOT NULL,
    opponent_rating_deviation INTEGER NOT NULL,
    result DECIMAL(3,2) NOT NULL, -- 1.0 for win, 0.5 for draw, 0.0 for loss
    rating_change INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for rating system
CREATE INDEX IF NOT EXISTS idx_profiles_rating ON profiles(rating);
CREATE INDEX IF NOT EXISTS idx_profiles_games_played ON profiles(games_played);
CREATE INDEX IF NOT EXISTS idx_rating_history_player_id ON rating_history(player_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_game_id ON rating_history(game_id);

-- Glicko-2 Rating System Constants
-- These values are based on Chess.com's implementation
CREATE OR REPLACE FUNCTION get_glicko2_constants()
RETURNS TABLE(
    tau DECIMAL(10,6),
    initial_rd INTEGER,
    min_rd INTEGER,
    max_rd INTEGER,
    initial_vol DECIMAL(10,6)
) AS $$
BEGIN
    RETURN QUERY SELECT 
        0.5::DECIMAL(10,6),    -- tau: system constant for volatility
        350::INTEGER,           -- initial_rd: initial rating deviation
        30::INTEGER,            -- min_rd: minimum rating deviation
        350::INTEGER,           -- max_rd: maximum rating deviation
        0.06::DECIMAL(10,6);   -- initial_vol: initial volatility
END;
$$ LANGUAGE plpgsql;

-- Convert Glicko-2 rating to display rating (like Chess.com)
CREATE OR REPLACE FUNCTION glicko2_to_display_rating(
    rating DECIMAL,
    rating_deviation INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    display_rating INTEGER;
    rd_factor DECIMAL;
BEGIN
    -- Apply rating deviation penalty (similar to Chess.com)
    rd_factor := GREATEST(0.5, 1.0 - (rating_deviation::DECIMAL / 350.0));
    display_rating := (rating * rd_factor)::INTEGER;
    
    -- Ensure minimum rating of 100
    RETURN GREATEST(100, display_rating);
END;
$$ LANGUAGE plpgsql;

-- Calculate expected score between two players
CREATE OR REPLACE FUNCTION calculate_expected_score(
    player_rating DECIMAL,
    player_rd INTEGER,
    opponent_rating DECIMAL,
    opponent_rd INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
    g_factor DECIMAL;
    e_score DECIMAL;
    q DECIMAL := 0.0057565; -- ln(10)/400
BEGIN
    -- Calculate g-factor (rating deviation factor)
    g_factor := 1.0 / SQRT(1.0 + 3.0 * (opponent_rd::DECIMAL * opponent_rd::DECIMAL * q * q) / (PI() * PI()));
    
    -- Calculate expected score
    e_score := 1.0 / (1.0 + POWER(10.0, -g_factor * (player_rating - opponent_rating) / 400.0));
    
    RETURN e_score;
END;
$$ LANGUAGE plpgsql;

-- Calculate new rating deviation (RD) after a game
CREATE OR REPLACE FUNCTION calculate_new_rd(
    old_rd INTEGER,
    volatility DECIMAL,
    time_factor DECIMAL DEFAULT 1.0
)
RETURNS INTEGER AS $$
DECLARE
    new_rd INTEGER;
    constants RECORD;
BEGIN
    SELECT * INTO constants FROM get_glicko2_constants();
    
    -- Apply time decay and volatility
    new_rd := SQRT(
        POWER(GREATEST(old_rd::DECIMAL, constants.min_rd::DECIMAL), 2) + 
        POWER(volatility * constants.tau, 2) * time_factor
    )::INTEGER;
    
    -- Ensure within bounds
    RETURN GREATEST(constants.min_rd, LEAST(constants.max_rd, new_rd));
END;
$$ LANGUAGE plpgsql;

-- Main Glicko-2 rating update function
CREATE OR REPLACE FUNCTION update_player_rating(
    player_id UUID,
    game_id UUID,
    opponent_rating DECIMAL,
    opponent_rd INTEGER,
    game_result DECIMAL, -- 1.0 for win, 0.5 for draw, 0.0 for loss
    game_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    old_rating INTEGER,
    new_rating INTEGER,
    old_rd INTEGER,
    new_rd INTEGER,
    old_vol DECIMAL,
    new_vol DECIMAL,
    rating_change INTEGER
) AS $$
DECLARE
    player_record RECORD;
    constants RECORD;
    expected_score DECIMAL;
    d_squared DECIMAL;
    new_rating DECIMAL;
    new_rd INTEGER;
    new_vol DECIMAL;
    rating_change INTEGER;
    time_factor DECIMAL;
    days_since_last_game INTEGER;
BEGIN
    -- Get player's current rating data
    SELECT rating, rating_deviation, volatility, last_game_at, games_played
    INTO player_record
    FROM profiles
    WHERE id = player_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found: %', player_id;
    END IF;
    
    -- Get system constants
    SELECT * INTO constants FROM get_glicko2_constants();
    
    -- Calculate time factor (rating deviation increases over time)
    IF player_record.last_game_at IS NOT NULL THEN
        days_since_last_game := EXTRACT(EPOCH FROM (game_date - player_record.last_game_at)) / 86400;
        time_factor := GREATEST(1.0, days_since_last_game / 30.0); -- Increase RD if more than 30 days
    ELSE
        time_factor := 1.0;
    END IF;
    
    -- Calculate new rating deviation
    new_rd := calculate_new_rd(player_record.rating_deviation, player_record.volatility, time_factor);
    
    -- Calculate expected score
    expected_score := calculate_expected_score(
        player_record.rating, 
        new_rd, 
        opponent_rating, 
        opponent_rd
    );
    
    -- Calculate d-squared (variance of the game outcome)
    d_squared := 1.0 / (POWER(0.0057565, 2) * expected_score * (1.0 - expected_score));
    
    -- Calculate new rating
    new_rating := player_record.rating + 
        (0.0057565 * new_rd * new_rd * (game_result - expected_score)) / d_squared;
    
    -- Calculate new volatility (simplified Glicko-2 volatility calculation)
    new_vol := GREATEST(
        constants.initial_vol * 0.5,
        LEAST(
            constants.initial_vol * 2.0,
            player_record.volatility * (0.9 + 0.1 * ABS(game_result - expected_score))
        )
    );
    
    -- Calculate rating change
    rating_change := (new_rating - player_record.rating)::INTEGER;
    
    -- Update player's rating in profiles table
    UPDATE profiles SET
        rating = new_rating::INTEGER,
        rating_deviation = new_rd,
        volatility = new_vol,
        games_played = games_played + 1,
        last_game_at = game_date,
        wins = CASE WHEN game_result = 1.0 THEN wins + 1 ELSE wins END,
        losses = CASE WHEN game_result = 0.0 THEN losses + 1 ELSE losses END,
        draws = CASE WHEN game_result = 0.5 THEN draws + 1 ELSE draws END
    WHERE id = player_id;
    
    -- Record rating history
    INSERT INTO rating_history (
        player_id, game_id, old_rating, new_rating, 
        old_rating_deviation, new_rating_deviation,
        old_volatility, new_volatility, opponent_rating, opponent_rd,
        result, rating_change
    ) VALUES (
        player_id, game_id, player_record.rating, new_rating::INTEGER,
        player_record.rating_deviation, new_rd,
        player_record.volatility, new_vol, opponent_rating, opponent_rd,
        game_result, rating_change
    );
    
    -- Return the rating changes
    RETURN QUERY SELECT 
        player_record.rating,
        new_rating::INTEGER,
        player_record.rating_deviation,
        new_rd,
        player_record.volatility,
        new_vol,
        rating_change;
END;
$$ LANGUAGE plpgsql;

-- Function to update all players' ratings after a game ends
CREATE OR REPLACE FUNCTION update_ratings_after_game(game_id UUID)
RETURNS VOID AS $$
DECLARE
    game_record RECORD;
    red_players RECORD;
    blue_players RECORD;
    red_avg_rating DECIMAL;
    red_avg_rd INTEGER;
    blue_avg_rating DECIMAL;
    blue_avg_rd INTEGER;
    game_winner TEXT;
    red_result DECIMAL;
    blue_result DECIMAL;
    player_record RECORD;
BEGIN
    -- Get game details
    SELECT status, winner, red_score, blue_score
    INTO game_record
    FROM games
    WHERE id = game_id;
    
    -- Only process completed games
    IF game_record.status != 'played' OR game_record.winner IS NULL THEN
        RETURN;
    END IF;
    
    -- Store winner in local variable to avoid ambiguity
    game_winner := game_record.winner;
    
    -- Get red team players and calculate average rating
    SELECT 
        AVG(p.rating) as avg_rating,
        AVG(p.rating_deviation) as avg_rd
    INTO red_players
    FROM game_players gp
    JOIN profiles p ON gp.player_id = p.id
    WHERE gp.game_id = game_id AND gp.team = 'red';
    
    -- Get blue team players and calculate average rating
    SELECT 
        AVG(p.rating) as avg_rating,
        AVG(p.rating_deviation) as avg_rd
    INTO blue_players
    FROM game_players gp
    JOIN profiles p ON gp.player_id = p.id
    WHERE gp.game_id = game_id AND gp.team = 'blue';
    
    -- Set results based on winner
    IF game_winner = 'red' THEN
        red_result := 1.0;
        blue_result := 0.0;
    ELSIF game_winner = 'blue' THEN
        red_result := 0.0;
        blue_result := 1.0;
    ELSE
        -- Handle draws (if implemented)
        red_result := 0.5;
        blue_result := 0.5;
    END IF;
    
    -- Update red team players' ratings
    FOR player_record IN
        SELECT gp.player_id, p.rating, p.rating_deviation
        FROM game_players gp
        JOIN profiles p ON gp.player_id = p.id
        WHERE gp.game_id = game_id AND gp.team = 'red'
    LOOP
        PERFORM update_player_rating(
            player_record.player_id,
            game_id,
            blue_players.avg_rating,
            blue_players.avg_rd,
            red_result
        );
    END LOOP;
    
    -- Update blue team players' ratings
    FOR player_record IN
        SELECT gp.player_id, p.rating, p.rating_deviation
        FROM game_players gp
        JOIN profiles p ON gp.player_id = p.id
        WHERE gp.game_id = game_id AND gp.team = 'blue'
    LOOP
        PERFORM update_player_rating(
            player_record.player_id,
            game_id,
            red_players.avg_rating,
            red_players.avg_rd,
            blue_result
        );
    END LOOP;
    
    RAISE NOTICE 'Updated ratings for game %: Red team (avg: %, rd: %), Blue team (avg: %, rd: %), Winner: %',
        game_id, red_players.avg_rating, red_players.avg_rd, blue_players.avg_rating, blue_players.avg_rd, game_winner;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update ratings when a game is completed
CREATE OR REPLACE FUNCTION trigger_update_ratings()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when game status changes to 'played'
    IF NEW.status = 'played' AND (OLD.status != 'played' OR OLD.status IS NULL) THEN
        PERFORM update_ratings_after_game(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_ratings'
    ) THEN
        CREATE TRIGGER trigger_update_ratings
            AFTER UPDATE ON games
            FOR EACH ROW
            EXECUTE FUNCTION trigger_update_ratings();
    END IF;
END $$;

-- Function to get player's current display rating (like Chess.com)
CREATE OR REPLACE FUNCTION get_player_display_rating(player_id UUID)
RETURNS TABLE(
    display_rating INTEGER,
    actual_rating INTEGER,
    rating_deviation INTEGER,
    games_played INTEGER,
    wins INTEGER,
    losses INTEGER,
    draws INTEGER,
    win_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY SELECT
        glicko2_to_display_rating(p.rating, p.rating_deviation) as display_rating,
        p.rating as actual_rating,
        p.rating_deviation,
        p.games_played,
        p.wins,
        p.losses,
        p.draws,
        CASE 
            WHEN p.games_played > 0 THEN (p.wins::DECIMAL / p.games_played * 100.0)
            ELSE 0.0
        END as win_rate
    FROM profiles p
    WHERE p.id = player_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(limit_count INTEGER DEFAULT 50)
RETURNS TABLE(
    rank INTEGER,
    player_id UUID,
    username TEXT,
    display_rating INTEGER,
    actual_rating INTEGER,
    games_played INTEGER,
    wins INTEGER,
    losses INTEGER,
    draws INTEGER,
    win_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY SELECT
        ROW_NUMBER() OVER (ORDER BY glicko2_to_display_rating(p.rating, p.rating_deviation) DESC) as rank,
        p.id as player_id,
        p.username,
        glicko2_to_display_rating(p.rating, p.rating_deviation) as display_rating,
        p.rating as actual_rating,
        p.games_played,
        p.wins,
        p.losses,
        p.draws,
        CASE 
            WHEN p.games_played > 0 THEN (p.wins::DECIMAL / p.games_played * 100.0)
            ELSE 0.0
        END as win_rate
    FROM profiles p
    WHERE p.games_played > 0
    ORDER BY glicko2_to_display_rating(p.rating, p.rating_deviation) DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Initialize ratings for existing players
UPDATE profiles 
SET 
    rating = 1500,
    rating_deviation = 350,
    volatility = 0.06
WHERE rating IS NULL;

-- Enable RLS on new tables
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;

-- Create policies for rating_history table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rating_history' AND policyname = 'Rating history viewable by authenticated users') THEN
        CREATE POLICY "Rating history viewable by authenticated users" ON rating_history
            FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END $$;
