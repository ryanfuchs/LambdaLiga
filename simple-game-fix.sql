-- Simple fix: Remove all ELO system triggers and complexity
-- Just allow games to be ended with a winner

-- 1. Drop all ELO-related triggers and functions
DROP TRIGGER IF EXISTS trigger_update_ratings ON games;
DROP FUNCTION IF EXISTS trigger_update_ratings();
DROP FUNCTION IF EXISTS update_ratings_after_game(UUID);
DROP FUNCTION IF EXISTS update_player_rating(UUID, UUID, DECIMAL, INTEGER, DECIMAL, TIMESTAMP WITH TIME ZONE);

-- 2. Keep the basic game functionality
-- The games table already has the necessary columns:
-- - status (lobby, playing, played, cancelled)
-- - winner (red, blue)
-- - red_score, blue_score

-- 3. Optional: Keep the rating_history table but remove the trigger
-- (You can manually update ratings later if needed)

-- That's it! Now games can be updated without any automatic triggers
