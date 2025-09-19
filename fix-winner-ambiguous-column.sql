-- Fix for ambiguous column reference error with 'winner' in ELO system
-- The issue is in the update_ratings_after_game function

-- Drop and recreate the update_ratings_after_game function with explicit column references
DROP FUNCTION IF EXISTS update_ratings_after_game(UUID);

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
    -- Get game details with explicit table reference
    SELECT g.status, g.winner, g.red_score, g.blue_score
    INTO game_record
    FROM games g
    WHERE g.id = game_id;
    
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

