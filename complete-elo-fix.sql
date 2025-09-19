-- Complete fix for all ambiguous column reference errors in ELO system
-- This fixes the trigger and all functions

-- 1. Drop and recreate the trigger first
DROP TRIGGER IF EXISTS trigger_update_ratings ON games;
DROP FUNCTION IF EXISTS trigger_update_ratings();

-- 2. Fix update_player_rating function (result parameter conflict)
DROP FUNCTION IF EXISTS update_player_rating(UUID, UUID, DECIMAL, INTEGER, DECIMAL, TIMESTAMP WITH TIME ZONE);

CREATE OR REPLACE FUNCTION update_player_rating(
    player_id UUID,
    target_game_id UUID,
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
        time_factor := GREATEST(1.0, days_since_last_game / 30.0);
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
        player_id, target_game_id, player_record.rating, new_rating::INTEGER,
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

-- 3. Fix update_ratings_after_game function (game_id parameter conflict)
DROP FUNCTION IF EXISTS update_ratings_after_game(UUID);

CREATE OR REPLACE FUNCTION update_ratings_after_game(target_game_id UUID)
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
    -- Get game details with explicit table reference
    SELECT g.status, g.winner, g.red_score, g.blue_score
    INTO game_record
    FROM games g
    WHERE g.id = target_game_id;
    
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
    WHERE gp.game_id = target_game_id AND gp.team = 'red';
    
    -- Get blue team players and calculate average rating
    SELECT 
        AVG(p.rating) as avg_rating,
        AVG(p.rating_deviation) as avg_rd
    INTO blue_players
    FROM game_players gp
    JOIN profiles p ON gp.player_id = p.id
    WHERE gp.game_id = target_game_id AND gp.team = 'blue';
    
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
        WHERE gp.game_id = target_game_id AND gp.team = 'red'
    LOOP
        PERFORM update_player_rating(
            player_record.player_id,
            target_game_id,
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
        WHERE gp.game_id = target_game_id AND gp.team = 'blue'
    LOOP
        PERFORM update_player_rating(
            player_record.player_id,
            target_game_id,
            red_players.avg_rating,
            red_players.avg_rd,
            blue_result
        );
    END LOOP;
    
    RAISE NOTICE 'Updated ratings for game %: Red team (avg: %, rd: %), Blue team (avg: %, rd: %), Winner: %',
        target_game_id, red_players.avg_rating, red_players.avg_rd, blue_players.avg_rating, blue_players.avg_rd, game_winner;
END;
$$ LANGUAGE plpgsql;

-- 4. Recreate the trigger function
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

-- 5. Recreate the trigger
CREATE TRIGGER trigger_update_ratings
    AFTER UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_ratings();
