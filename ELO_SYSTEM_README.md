# 🏆 LambdaLiga ELO Rating System

This document explains the ELO rating system implemented for LambdaLiga, based on **Chess.com's Glicko-2 rating system**.

## 🎯 **What is Glicko-2?**

Glicko-2 is an improvement over the traditional ELO system that:
- **Tracks rating uncertainty** (Rating Deviation - RD)
- **Accounts for volatility** in player performance
- **Handles time decay** (ratings become less certain over time)
- **Provides more accurate matchmaking** and rating calculations

## 🏗️ **System Architecture**

### **Database Tables**

#### **1. Profiles Table (Enhanced)**
```sql
profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE,
    rating INTEGER DEFAULT 1500,           -- Glicko-2 rating
    rating_deviation INTEGER DEFAULT 350,  -- Rating uncertainty
    volatility DECIMAL(10,6) DEFAULT 0.06, -- Performance volatility
    games_played INTEGER DEFAULT 0,        -- Total games
    wins INTEGER DEFAULT 0,                -- Total wins
    losses INTEGER DEFAULT 0,              -- Total losses
    draws INTEGER DEFAULT 0,               -- Total draws
    last_game_at TIMESTAMP,                -- Last game played
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

#### **2. Rating History Table**
```sql
rating_history (
    id UUID PRIMARY KEY,
    player_id UUID REFERENCES profiles(id),
    game_id UUID REFERENCES games(id),
    old_rating INTEGER,                    -- Rating before game
    new_rating INTEGER,                    -- Rating after game
    old_rating_deviation INTEGER,          -- RD before game
    new_rating_deviation INTEGER,          -- RD after game
    old_volatility DECIMAL,                -- Volatility before game
    new_volatility DECIMAL,                -- Volatility after game
    opponent_rating INTEGER,               -- Opponent's rating
    opponent_rating_deviation INTEGER,     -- Opponent's RD
    result DECIMAL(3,2),                  -- 1.0=win, 0.5=draw, 0.0=loss
    rating_change INTEGER,                 -- Points gained/lost
    created_at TIMESTAMP
)
```

## 🔢 **Rating Calculation**

### **Initial Values**
- **Starting Rating**: 1500 (standard chess rating)
- **Starting RD**: 350 (high uncertainty for new players)
- **Starting Volatility**: 0.06 (baseline volatility)

### **Rating Update Formula**
```sql
-- Expected score calculation
expected_score = 1 / (1 + 10^(-g_factor * (rating_diff) / 400))

-- New rating calculation
new_rating = old_rating + (K * RD² * (actual_score - expected_score)) / variance

-- New RD calculation
new_rd = √(old_rd² + volatility² * τ² * time_factor)
```

### **Key Factors**
1. **Rating Difference**: Higher rated players are expected to win
2. **Rating Deviation**: Less certain ratings change more dramatically
3. **Volatility**: Players with inconsistent performance have higher volatility
4. **Time Factor**: Ratings become less certain over time

## 🚀 **How It Works**

### **1. Automatic Rating Updates**
When a game ends:
1. **Game status changes** to 'played'
2. **Database trigger fires** automatically
3. **Team average ratings** are calculated
4. **Individual ratings** are updated for all players
5. **Rating history** is recorded for audit trail

### **2. Team Rating Calculation**
- **Red Team**: Average rating of all red team players
- **Blue Team**: Average rating of all blue team players
- **Individual Updates**: Each player's rating updated against opponent team average

### **3. Result Processing**
- **Win**: 1.0 points, rating increases
- **Loss**: 0.0 points, rating decreases
- **Draw**: 0.5 points (if implemented)

## 📊 **Display Rating vs. Actual Rating**

### **Display Rating (What Users See)**
```sql
display_rating = actual_rating * (1 - RD/350)
```
- **Lower RD** = Higher display rating
- **Higher RD** = Lower display rating (penalty for uncertainty)
- **Minimum**: 100 rating

### **Actual Rating (Internal Calculation)**
- **True Glicko-2 rating** used for calculations
- **Not displayed** to users
- **More accurate** for matchmaking

## 🎮 **Game Flow with ELO**

### **Before Game**
1. Players join teams
2. System calculates expected outcome based on ratings
3. **Unbalanced teams** show ELO warning message

### **During Game**
1. Game status: 'playing'
2. No rating changes yet

### **After Game**
1. **Scores submitted** → Game status: 'played'
2. **Trigger fires** → Ratings automatically updated
3. **History recorded** → All changes logged
4. **Players redirected** → Back to dashboard

## 🔧 **Database Functions**

### **Core Functions**
- `update_player_rating()` - Updates individual player rating
- `update_ratings_after_game()` - Updates all players in a game
- `calculate_expected_score()` - Calculates win probability
- `glicko2_to_display_rating()` - Converts to display rating

### **Utility Functions**
- `get_player_display_rating()` - Gets player's current stats
- `get_leaderboard()` - Gets top players ranking
- `get_glicko2_constants()` - System configuration

### **Automatic Triggers**
- `trigger_update_ratings()` - Fires when game completes

## 📈 **Rating Changes Examples**

### **Scenario 1: Upset Victory**
- **Player A**: 1500 rating, 350 RD
- **Player B**: 1600 rating, 350 RD
- **Result**: Player A wins
- **Player A**: +25 points (upset bonus)
- **Player B**: -25 points (upset penalty)

### **Scenario 2: Expected Result**
- **Player A**: 1600 rating, 350 RD
- **Player B**: 1500 rating, 350 RD
- **Result**: Player A wins
- **Player A**: +8 points (expected win)
- **Player B**: -8 points (expected loss)

### **Scenario 3: High RD Player**
- **Player A**: 1500 rating, 100 RD (established)
- **Player B**: 1500 rating, 350 RD (new player)
- **Result**: Player A wins
- **Player A**: +5 points (small change, low RD)
- **Player B**: -15 points (bigger change, high RD)

## 🛡️ **Security Features**

### **Server-Side Only**
- **No client-side calculations** - prevents manipulation
- **Database triggers** - ensures consistency
- **Transaction safety** - all updates succeed or fail together

### **Audit Trail**
- **Complete history** of all rating changes
- **Game association** - trace changes to specific games
- **Player tracking** - see rating evolution over time

## 📋 **Setup Instructions**

### **1. Apply ELO Schema**
```bash
# Run the ELO system SQL
psql -d your_database -f elo-system.sql
```

### **2. Test the System**
```bash
# Run test script
psql -d your_database -f test-elo-system.sql
```

### **3. Verify Installation**
```sql
-- Check if functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%rating%';

-- Check if triggers exist
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_update_ratings';
```

## 🧪 **Testing the System**

### **Manual Test**
1. **Create a game** with two players
2. **Complete the game** (submit scores)
3. **Check ratings** - should update automatically
4. **Verify history** - rating_history table should have records

### **Test Script**
Use `test-elo-system.sql` to:
- Verify all functions work
- Check trigger installation
- Test rating calculations
- Validate data integrity

## 📊 **Monitoring & Analytics**

### **Key Metrics**
- **Rating distribution** across player base
- **Rating volatility** trends
- **Win rate** vs. rating correlation
- **Rating change** patterns

### **Queries for Insights**
```sql
-- Rating distribution
SELECT 
    CASE 
        WHEN rating < 1200 THEN 'Beginner'
        WHEN rating < 1400 THEN 'Intermediate'
        WHEN rating < 1600 THEN 'Advanced'
        ELSE 'Expert'
    END as skill_level,
    COUNT(*) as players
FROM profiles 
GROUP BY skill_level;

-- Rating volatility analysis
SELECT 
    AVG(volatility) as avg_volatility,
    STDDEV(volatility) as volatility_stddev
FROM profiles;
```

## 🔮 **Future Enhancements**

### **Potential Features**
- **Rating floors** - prevent ratings from going too low
- **Rating ceilings** - cap maximum ratings
- **Seasonal resets** - periodic rating adjustments
- **Tournament bonuses** - special events with rating multipliers
- **Team rating formulas** - different calculations for team games

### **Advanced Analytics**
- **Rating prediction** - forecast future ratings
- **Matchmaking algorithms** - find balanced opponents
- **Performance trends** - identify improving/declining players

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Ratings Not Updating**
- Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_ratings';`
- Verify game status is 'played'
- Check database logs for errors

#### **2. Function Errors**
- Ensure all functions are created: `SELECT proname FROM pg_proc WHERE proname LIKE '%rating%';`
- Check function permissions
- Verify database user has execute privileges

#### **3. Performance Issues**
- Check indexes: `SELECT * FROM pg_indexes WHERE tablename LIKE '%rating%';`
- Monitor query performance
- Consider partitioning for large datasets

## 📚 **References**

- **Glicko-2 Paper**: [Glickman, M. E. (2013). Example of the Glicko-2 system](http://www.glicko.net/glicko/glicko2.pdf)
- **Chess.com Implementation**: Based on their rating system
- **PostgreSQL Documentation**: [PL/pgSQL Functions](https://www.postgresql.org/docs/current/plpgsql.html)

---

**🎉 Congratulations!** You now have a professional-grade ELO rating system that automatically handles all rating calculations, updates, and history tracking. The system is secure, scalable, and follows industry best practices.

