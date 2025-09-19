-- Test script for the ELO system
-- This script tests the rating calculations and updates

-- First, let's check the current state
SELECT 'Current profiles with ratings:' as info;
SELECT 
    username,
    rating,
    rating_deviation,
    volatility,
    games_played,
    wins,
    losses,
    draws
FROM profiles
ORDER BY rating DESC;

-- Test 1: Simulate a game between two players
-- Let's create a test game and update ratings manually

-- First, let's see what games exist
SELECT 'Current games:' as info;
SELECT 
    id,
    status,
    winner,
    red_score,
    blue_score,
    created_at
FROM games
ORDER BY created_at DESC
LIMIT 5;

-- Test 2: Check if the trigger is working
-- Let's look at the trigger definition
SELECT 'Trigger information:' as info;
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'trigger_update_ratings';

-- Test 3: Test the rating calculation functions
SELECT 'Testing rating calculation functions:' as info;

-- Test expected score calculation
SELECT 
    'Expected score test:' as test_type,
    calculate_expected_score(1500, 350, 1500, 350) as expected_score_equal_ratings,
    calculate_expected_score(1600, 350, 1500, 350) as expected_score_higher_rating,
    calculate_expected_score(1500, 350, 1600, 350) as expected_score_lower_rating;

-- Test Glicko-2 constants
SELECT 'Glicko-2 constants:' as info, * FROM get_glicko2_constants();

-- Test display rating conversion
SELECT 'Display rating conversion test:' as info;
SELECT 
    rating,
    rating_deviation,
    glicko2_to_display_rating(rating, rating_deviation) as display_rating
FROM profiles
LIMIT 3;

-- Test 4: Check if rating history table exists and is accessible
SELECT 'Rating history table check:' as info;
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT player_id) as unique_players,
    COUNT(DISTINCT game_id) as unique_games
FROM rating_history;

-- Test 5: Test the leaderboard function
SELECT 'Leaderboard test:' as info;
SELECT * FROM get_leaderboard(10);

-- Test 6: Test individual player rating display
SELECT 'Individual player rating test:' as info;
SELECT 
    p.username,
    p.rating,
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
WHERE p.games_played > 0
ORDER BY p.rating DESC
LIMIT 5;

-- Test 7: Check for any recent rating changes
SELECT 'Recent rating changes:' as info;
SELECT 
    rh.player_id,
    p.username,
    rh.old_rating,
    rh.new_rating,
    rh.rating_change,
    rh.result,
    rh.created_at
FROM rating_history rh
JOIN profiles p ON rh.player_id = p.id
ORDER BY rh.created_at DESC
LIMIT 10;

-- Summary of what we've tested
SELECT 'ELO System Test Summary:' as summary;
SELECT 
    'Profiles table' as component,
    COUNT(*) as count,
    'profiles' as table_name
FROM profiles
UNION ALL
SELECT 
    'Rating history' as component,
    COUNT(*) as count,
    'rating_history' as table_name
FROM rating_history
UNION ALL
SELECT 
    'Games' as component,
    COUNT(*) as count,
    'games' as table_name
FROM games
UNION ALL
SELECT 
    'Triggers' as component,
    COUNT(*) as count,
    'pg_trigger' as table_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'trigger_update_ratings';

