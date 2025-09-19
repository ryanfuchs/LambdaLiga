-- Fix for ambiguous column reference error in ELO system
-- The issue was that 'result' parameter conflicted with 'result' column in rating_history table

-- Drop and recreate the update_player_rating function with renamed parameter
DROP FUNCTION IF EXISTS update_player_rating(UUID, UUID, DECIMAL, INTEGER, DECIMAL, TIMESTAMP WITH TIME ZONE);

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

