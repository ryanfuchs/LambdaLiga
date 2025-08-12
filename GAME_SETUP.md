# LambdaLiga Game System Setup

This document explains how to set up and use the new game system for LambdaLiga.

## Database Setup

### 1. Run the SQL Schema

Execute the `game-schema.sql` file in your Supabase SQL editor to create the necessary tables:

- `games` - Stores game information and status
- `game_players` - Tracks which players are in which games and teams
- `profiles` - Stores user profile information (usernames)

### 2. Tables Structure

#### Games Table
- `id` - Unique game identifier
- `status` - Game status: 'lobby', 'playing', 'played', 'cancelled'
- `red_team` - Array of player IDs on red team
- `blue_team` - Array of player IDs on blue team
- `winner` - Winning team ('red' or 'blue') when game is finished
- `created_at` - When the game was created
- `updated_at` - When the game was last updated

#### Game Players Table
- `id` - Unique identifier
- `game_id` - Reference to the game
- `player_id` - Reference to the user
- `team` - Which team the player is on ('red' or 'blue')
- `joined_at` - When the player joined the game

#### Profiles Table
- `id` - Reference to the user
- `username` - Display name for the user
- `created_at` - When the profile was created
- `updated_at` - When the profile was last updated

## Game Flow

### 1. Lobby State
- Players can join either red or blue team
- Each team can have 1-2 players
- Game can be started when both teams have at least 1 player
- Game can be cancelled

### 2. Playing State
- Game is active
- Players can declare a winner (red or blue team)
- Game moves to 'played' state when winner is declared

### 3. Played State
- Game is finished
- Winner is recorded
- Players can start a new game

### 4. Cancelled State
- Game was cancelled
- Players can start a new game

## Features

### Team Management
- Red and blue teams with 1-2 players each
- Players can only be on one team per game
- Teams are visually distinct with color coding

### Game Controls
- **Start Game**: Available when both teams have players
- **End Game**: Declare winner during playing state
- **Cancel Game**: Cancel during lobby state
- **New Game**: Start fresh game after completion

### Player Experience
- Real-time team assignment
- Visual feedback for current team
- Game status indicators
- Player count tracking

## Usage

### Accessing the Game
1. Navigate to `/game` in your browser
2. Must be logged in to access
3. Automatically finds existing lobby or creates new game

### Joining a Team
1. Click "Join Red Team" or "Join Blue Team"
2. Team assignment is immediate
3. Cannot change teams once assigned

### Starting a Game
1. At least one player must be on each team
2. Click "Start Game" button
3. Game status changes to "playing"

### Ending a Game
1. During playing state, click winner button
2. Game status changes to "played"
3. Winner is recorded

## Technical Implementation

### Frontend
- React component with TypeScript
- Uses Supabase client for database operations
- Real-time state management
- Responsive design with Tailwind CSS

### Backend
- Supabase database with PostgreSQL
- Row Level Security (RLS) enabled
- Proper indexing for performance
- Automatic timestamp updates

### Security
- Authentication required for all operations
- Users can only modify their own data
- Game state validation
- Team size limits enforced

## Troubleshooting

### Common Issues

1. **"No game in lobby" error**
   - Check if there are existing games with 'lobby' status
   - Verify database connection

2. **Cannot join team**
   - Ensure you're not already in a team
   - Check if team is full (max 2 players)
   - Verify authentication status

3. **Game won't start**
   - Ensure both teams have at least 1 player
   - Check game status is 'lobby'
   - Verify database permissions

### Database Queries

To check current games:
```sql
SELECT * FROM games ORDER BY created_at DESC;
```

To check players in a game:
```sql
SELECT gp.*, p.username 
FROM game_players gp 
JOIN profiles p ON gp.player_id = p.id 
WHERE gp.game_id = 'your-game-id';
```

## Future Enhancements

- Real-time multiplayer updates
- Game statistics tracking
- Tournament system integration
- Spectator mode
- Chat functionality
- Game replay system
