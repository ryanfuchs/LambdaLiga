'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Game {
  id: string
  status: 'lobby' | 'playing' | 'played' | 'cancelled'
  winner?: 'red' | 'blue'
  created_at: string
  updated_at: string
}

interface Player {
  id: string
  username: string
  team: 'red' | 'blue' | null
}

export default function GamePage() {
  const { user } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningTeam, setJoiningTeam] = useState<'red' | 'blue' | null>(null)

  useEffect(() => {
    if (user) {
      ensureProfileExists()
    }
  }, [user])

  const ensureProfileExists = async () => {
    if (!user) return
    
    try {
      // Check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking profile:', checkError)
        return
      }

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Player'
        const { error: createError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              username: username
            }
          ])

        if (createError) {
          console.error('Error creating profile:', createError)
        } else {
          console.log('Profile created for user:', username)
        }
      }

      // Clean up any duplicate lobby games before loading
      await cleanupDuplicateLobbyGames()
      
      // Load game after ensuring profile exists
      loadGame()
    } catch (error) {
      console.error('Error ensuring profile exists:', error)
      // Still try to load game even if profile creation fails
      loadGame()
    }
  }

  const cleanupDuplicateLobbyGames = async () => {
    try {
      // Get all active games (lobby and playing)
      const { data: activeGames, error } = await supabase
        .from('games')
        .select('id, created_at, status')
        .in('status', ['lobby', 'playing'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error checking for duplicate games:', error)
        return
      }

      if (activeGames && activeGames.length > 1) {
        console.log(`Found ${activeGames.length} active games, keeping only the most recent one`)
        
        // Keep the most recent game, delete the rest
        const gamesToDelete = activeGames.slice(1)
        const gameIdsToDelete = gamesToDelete.map(g => g.id)
        
        // Delete the duplicate games
        const { error: deleteError } = await supabase
          .from('games')
          .delete()
          .in('id', gameIdsToDelete)

        if (deleteError) {
          console.error('Error deleting duplicate games:', deleteError)
        } else {
          console.log(`Deleted ${gamesToDelete.length} duplicate active games`)
        }
      }
    } catch (error) {
      console.error('Error cleaning up duplicate games:', error)
    }
  }

  const loadGame = async () => {
    try {
      setLoading(true)
      
      // First, try to find any existing active game (lobby, playing, or recent finished games)
      const { data: existingGames, error: gameError } = await supabase
        .from('games')
        .select('*')
        .in('status', ['lobby', 'playing'])
        .order('created_at', { ascending: false })

      if (gameError) {
        console.error('Error loading games:', gameError)
        return
      }

      if (existingGames && existingGames.length > 0) {
        // Use the most recent active game
        const existingGame = existingGames[0]
        console.log('Found existing game:', existingGame.id, 'with status:', existingGame.status)
        setGame(existingGame)
        await loadPlayers(existingGame.id)
      } else {
        // Check for very recent finished games (within last 5 minutes) to avoid creating new ones too quickly
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const { data: recentGames } = await supabase
          .from('games')
          .select('*')
          .in('status', ['played', 'cancelled'])
          .gte('updated_at', fiveMinutesAgo)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (recentGames && recentGames.length > 0) {
          // Use the most recent finished game
          const recentGame = recentGames[0]
          console.log('Found recent finished game:', recentGame.id, 'with status:', recentGame.status)
          setGame(recentGame)
          await loadPlayers(recentGame.id)
        } else {
          // No recent games found, create a new one
          console.log('No recent games found, creating new game...')
          await createNewGame()
        }
      }
    } catch (error) {
      console.error('Error in loadGame:', error)
    } finally {
      setLoading(false)
    }
  }

  const createNewGame = async () => {
    try {
      console.log('Creating new game...')
      
      const { data: newGame, error } = await supabase
        .from('games')
        .insert([
          {
            status: 'lobby'
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Error creating game:', error)
        return
      }

      console.log('New game created:', newGame.id)
      setGame(newGame)
      setPlayers([])
    } catch (error) {
      console.error('Error creating new game:', error)
    }
  }

  const loadPlayers = async (gameId: string) => {
    try {
      console.log('Loading players for game:', gameId)
      
      // First get the game players
      const { data: gamePlayers, error: gamePlayersError } = await supabase
        .from('game_players')
        .select('id, player_id, team')
        .eq('game_id', gameId)

      if (gamePlayersError) {
        console.error('Error loading game players:', gamePlayersError)
        return
      }

      if (!gamePlayers || gamePlayers.length === 0) {
        setPlayers([])
        return
      }

      // Get the player IDs
      const playerIds = gamePlayers.map(gp => gp.player_id)
      
      // Fetch profiles for these players
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', playerIds)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        return
      }

      // Create a map of player ID to username
      const usernameMap = new Map(profiles?.map(p => [p.id, p.username]) || [])
      
      // Combine the data
      const formattedPlayers: Player[] = gamePlayers.map(gp => ({
        id: gp.player_id,
        username: usernameMap.get(gp.player_id) || 'Unknown Player',
        team: gp.team
      }))

      console.log('Formatted players:', formattedPlayers)
      setPlayers(formattedPlayers)
    } catch (error) {
      console.error('Error loading players:', error)
    }
  }

  const joinTeam = async (team: 'red' | 'blue') => {
    if (!user || !game) return

    try {
      setJoiningTeam(team)
      
      // Check if team is full
      const teamPlayers = players.filter(p => p.team === team)
      if (teamPlayers.length >= 2) {
        alert('This team is full!')
        return
      }

      // Check if player is already in a team
      const existingPlayer = players.find(p => p.id === user.id)
      
      if (existingPlayer) {
        // Player is switching teams
        if (existingPlayer.team === team) {
          alert('You are already on this team!')
          return
        }
        
        // Update existing player's team
        const { error } = await supabase
          .from('game_players')
          .update({ team: team })
          .eq('game_id', game.id)
          .eq('player_id', user.id)

        if (error) {
          console.error('Error switching teams:', error)
          alert('Failed to switch teams')
          return
        }

        console.log(`Successfully switched to ${team} team`)
      } else {
        // Player is joining for the first time
        const { error } = await supabase
          .from('game_players')
          .insert([
            {
              game_id: game.id,
              player_id: user.id,
              team: team
            }
          ])

        if (error) {
          console.error('Error joining team:', error)
          alert('Failed to join team')
          return
        }

        console.log(`Successfully joined ${team} team`)
      }

      // Reload players to get updated state
      await loadPlayers(game.id)
      
      // Update the local game state for immediate UI feedback
      setGame({ ...game })

    } catch (error) {
      console.error('Error joining team:', error)
      alert('Failed to join team')
    } finally {
      setJoiningTeam(null)
    }
  }

  const startGame = async () => {
    if (!game) return

    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'playing' })
        .eq('id', game.id)

      if (error) {
        console.error('Error starting game:', error)
        return
      }

      setGame({ ...game, status: 'playing' })
    } catch (error) {
      console.error('Error starting game:', error)
    }
  }

  const endGame = async (winner: 'red' | 'blue') => {
    if (!game) return

    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          status: 'played',
          winner: winner
        })
        .eq('id', game.id)

      if (error) {
        console.error('Error ending game:', error)
        return
      }

      setGame({ ...game, status: 'played' })
    } catch (error) {
      console.error('Error ending game:', error)
    }
  }

  const cancelGame = async () => {
    if (!game) return

    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'cancelled' })
        .eq('id', game.id)

      if (error) {
        console.error('Error cancelling game:', error)
        return
      }

      setGame({ ...game, status: 'cancelled' })
    } catch (error) {
      console.error('Error cancelling game:', error)
    }
  }

  const canStartGame = game && 
    game.status === 'lobby' && 
    players.filter(p => p.team === 'red').length >= 1 && 
    players.filter(p => p.team === 'blue').length >= 1

  const isPlayerInGame = players.some(p => p.id === user?.id)
  const playerTeam = players.find(p => p.id === user?.id)?.team

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lambdaliga-light via-lambdaliga-secondary to-lambdaliga-light flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-3xl mb-6 shadow-glow">
            <span className="text-3xl font-bold text-white">LL</span>
          </div>
          <h1 className="text-4xl font-bold text-lambdaliga-primary mb-4">LambdaLiga</h1>
          <p className="text-gray-600 text-lg">Loading game...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lambdaliga-light via-lambdaliga-secondary to-lambdaliga-light flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-3xl mb-6 shadow-glow">
            <span className="text-3xl font-bold text-white">LL</span>
          </div>
          <h1 className="text-4xl font-bold text-lambdaliga-primary mb-4">LambdaLiga</h1>
          <p className="text-gray-600 text-lg">Please log in to play</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lambdaliga-light via-lambdaliga-secondary to-lambdaliga-light">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-lambdaliga-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">LL</span>
              </div>
              <span className="text-xl font-bold text-lambdaliga-primary">LambdaLiga</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.history.back()}
                className="border-lambdaliga-primary text-lambdaliga-primary hover:bg-lambdaliga-primary hover:text-white"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-lambdaliga-primary">LambdaLiga Game</h1>
        
        {/* Game Status */}
        <div className="text-center mb-8">
          <div className={`inline-block px-6 py-3 rounded-full text-lg font-semibold text-white ${
            game?.status === 'lobby' ? 'bg-lambdaliga-accent' :
            game?.status === 'playing' ? 'bg-lambdaliga-primary' :
            game?.status === 'played' ? 'bg-blue-500' :
            'bg-red-500'
          }`}>
            {game?.status?.toUpperCase()}
          </div>
        </div>

        {/* Game ID */}
        <div className="text-center mb-8 text-gray-600">
          Game ID: {game?.id}
        </div>

        {/* Teams Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Red Team */}
          <div className="bg-white/80 backdrop-blur-md border-2 border-red-500 rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-red-600 mb-4 text-center">Red Team</h2>
            <div className="space-y-3">
              {players.filter(p => p.team === 'red').map((player, index) => (
                <div key={player.id} className="bg-red-100 border border-red-300 p-3 rounded-xl text-center text-red-800 font-medium">
                  {player.username}
                </div>
              ))}
              {players.filter(p => p.team === 'red').length === 0 && (
                <div className="text-red-400 text-center py-6">No players</div>
              )}
              {players.filter(p => p.team === 'red').length < 2 && game?.status === 'lobby' && (
                !isPlayerInGame ? (
                  <Button
                    onClick={() => joinTeam('red')}
                    disabled={joiningTeam === 'red'}
                    className="w-full bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600"
                  >
                    {joiningTeam === 'red' ? 'Joining...' : 'Join Red Team'}
                  </Button>
                ) : playerTeam === 'blue' ? (
                  <Button
                    onClick={() => joinTeam('red')}
                    disabled={joiningTeam === 'red'}
                    className="w-full bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600"
                  >
                    {joiningTeam === 'red' ? 'Switching...' : 'Switch to Red Team'}
                  </Button>
                ) : playerTeam === 'red' ? (
                  <div className="text-center py-2 px-4 bg-red-100 border border-red-300 rounded-lg text-red-800 font-medium">
                    You are here
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* Blue Team */}
          <div className="bg-white/80 backdrop-blur-md border-2 border-blue-500 rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-blue-600 mb-4 text-center">Blue Team</h2>
            <div className="space-y-3">
              {players.filter(p => p.team === 'blue').map((player, index) => (
                <div key={player.id} className="bg-blue-100 border border-blue-300 p-3 rounded-xl text-center text-blue-800 font-medium">
                  {player.username}
                </div>
              ))}
              {players.filter(p => p.team === 'blue').length === 0 && (
                <div className="text-blue-400 text-center py-6">No players</div>
              )}
              {players.filter(p => p.team === 'blue').length < 2 && game?.status === 'lobby' && !isPlayerInGame && (
                <Button
                  onClick={() => joinTeam('blue')}
                  disabled={joiningTeam === 'blue'}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600"
                >
                  {joiningTeam === 'blue' ? 'Joining...' : 'Join Blue Team'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Player Status */}
        {isPlayerInGame && (
          <div className="text-center mb-8">
            <div className={`inline-block px-6 py-3 rounded-full text-sm font-semibold text-white ${
              playerTeam === 'red' ? 'bg-red-500' : 'bg-blue-500'
            }`}>
              You are on the {playerTeam} team
            </div>
          </div>
        )}

        {/* Game Controls */}
        <div className="flex flex-wrap gap-4 justify-center">
          {game?.status === 'lobby' && canStartGame && (
            <Button
              onClick={startGame}
              className="bg-lambdaliga-primary hover:bg-lambdaliga-accent text-white px-8 py-3 text-lg border-lambdaliga-primary hover:border-lambdaliga-accent"
            >
              Start Game
            </Button>
          )}

          {game?.status === 'playing' && (
            <>
              <Button
                onClick={() => endGame('red')}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 text-lg border-red-500 hover:border-red-600"
              >
                Red Team Wins
              </Button>
              <Button
                onClick={() => endGame('blue')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 text-lg border-blue-500 hover:border-blue-600"
              >
                Blue Team Wins
              </Button>
            </>
          )}

          {game?.status === 'lobby' && (
            <Button
              onClick={cancelGame}
              className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 text-lg border-red-500 hover:border-red-600"
            >
              Cancel Game
            </Button>
          )}

          {(game?.status === 'played' || game?.status === 'cancelled') && (
            <Button
              onClick={async () => {
                // Check if there are any existing lobby games before creating a new one
                const { data: existingLobbyGames } = await supabase
                  .from('games')
                  .select('id')
                  .eq('status', 'lobby')
                
                if (existingLobbyGames && existingLobbyGames.length > 0) {
                  alert('There is already a game in lobby status. Please join that game instead.')
                  return
                }
                
                await createNewGame()
              }}
              className="bg-lambdaliga-primary hover:bg-lambdaliga-accent text-white px-8 py-3 text-lg border-lambdaliga-primary hover:border-lambdaliga-accent"
            >
              New Game
            </Button>
          )}
        </div>

        {/* Game Info */}
        <div className="mt-8 text-center text-gray-600 bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-lambdaliga-secondary">
          <p className="text-lg font-medium mb-2">Game Status</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-lambdaliga-primary">{players.length}</p>
              <p className="text-sm">Total Players</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{players.filter(p => p.team === 'red').length}</p>
              <p className="text-sm">Red Team</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">{players.filter(p => p.team === 'blue').length}</p>
              <p className="text-sm">Blue Team</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
