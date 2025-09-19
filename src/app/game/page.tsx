'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Game {
  id: string
  status: 'lobby' | 'playing' | 'played' | 'cancelled'
  winner?: 'red' | 'blue'
  red_team_size: number
  blue_team_size: number
  red_score?: number
  blue_score?: number
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
  const [redTeamSize, setRedTeamSize] = useState(1)
  const [blueTeamSize, setBlueTeamSize] = useState(1)

  const updateTeamSize = async (team: 'red' | 'blue', size: number) => {
    if (!game || game.status !== 'lobby') return
    
    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          [`${team}_team_size`]: size 
        })
        .eq('id', game.id)

      if (error) {
        console.error(`Error updating ${team} team size:`, error)
        return
      }

      // Update local state
      setGame({ ...game, [`${team}_team_size`]: size })
      
      if (team === 'red') {
        setRedTeamSize(size)
      } else {
        setBlueTeamSize(size)
      }

      console.log(`${team} team size updated to ${size}`)
    } catch (error) {
      console.error(`Error updating ${team} team size:`, error)
    }
  }

  const ensureProfileExists = useCallback(async () => {
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
  }, [user])

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

  // Game Result Submission Component
  const GameResultSubmission = ({ onGameEnd }: { onGameEnd: (winner: 'red' | 'blue', redScore: number, blueScore: number) => void }) => {
    const [redScore, setRedScore] = useState<number>(0)
    const [blueScore, setBlueScore] = useState<number>(0)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Automatically determine winner based on scores
    const winner = redScore > blueScore ? 'red' : blueScore > redScore ? 'blue' : null
    const isTie = redScore === blueScore && redScore > 0

    const handleSubmit = async () => {
      if (isTie) {
        alert('Please set different scores for the teams')
        return
      }
      
      if (redScore === 0 && blueScore === 0) {
        alert('Please set scores for both teams')
        return
      }
      
      setIsSubmitting(true)
      await onGameEnd(winner!, redScore, blueScore)
      setIsSubmitting(false)
    }

    return (
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-lambdaliga-secondary">
        <h3 className="text-xl font-bold text-lambdaliga-primary mb-6 text-center">Game Result Submission</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Red Team Score */}
          <div className="text-center">
            <label className="block text-red-600 font-semibold mb-2">Red Team Score</label>
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => setRedScore(Math.max(0, redScore - 1))}
                className="w-10 h-10 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold text-lg"
              >
                -
              </button>
              <span className="w-16 h-10 bg-red-50 border border-red-300 rounded-lg flex items-center justify-center text-red-800 font-bold text-xl">
                {redScore}
              </span>
              <button
                onClick={() => setRedScore(redScore + 1)}
                className="w-10 h-10 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Blue Team Score */}
          <div className="text-center">
            <label className="block text-blue-600 font-semibold mb-2">Blue Team Score</label>
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => setBlueScore(Math.max(0, blueScore - 1))}
                className="w-10 h-10 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-bold text-lg"
              >
                -
              </button>
              <span className="w-16 h-10 bg-blue-50 border border-blue-300 rounded-lg flex items-center justify-center text-blue-800 font-bold text-xl">
                {blueScore}
              </span>
              <button
                onClick={() => setBlueScore(blueScore + 1)}
                className="w-10 h-10 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-bold text-lg"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Winner Display */}
        <div className="text-center mb-6">
          {winner && !isTie ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-green-800 font-medium">
                🏆 {winner === 'red' ? 'Red Team' : 'Blue Team'} will win with {winner === 'red' ? redScore : blueScore} points
              </p>
            </div>
          ) : isTie ? (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-yellow-800 font-medium">
                ⚠️ It&apos;s a tie! Please set different scores
              </p>
            </div>
          ) : redScore === 0 && blueScore === 0 ? (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-gray-800 font-medium">
                📊 Set scores to see the winner
              </p>
            </div>
          ) : null}
        </div>

        {/* Submit Button */}
        <div className="text-center">
          <Button
            onClick={handleSubmit}
            disabled={isTie || (redScore === 0 && blueScore === 0) || isSubmitting}
            className="bg-lambdaliga-primary hover:bg-lambdaliga-accent text-white px-8 py-3 text-lg border-lambdaliga-primary hover:border-lambdaliga-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Result'}
          </Button>
        </div>
      </div>
    )
  }

  const loadGame = useCallback(async () => {
    try {
      setLoading(true)
      
      // Only look for active games (lobby or playing)
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
        console.log('Found existing active game:', existingGame.id, 'with status:', existingGame.status)
        setGame(existingGame)
        await loadPlayers(existingGame.id)
      } else {
        // No active games found, create a new one
        console.log('No active games found, creating new game...')
        await createNewGame()
      }
    } catch (error) {
      console.error('Error in loadGame:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const createNewGame = async () => {
    try {
      console.log('Creating new game...')
      
      // Reset team sizes to default
      setRedTeamSize(1)
      setBlueTeamSize(1)
      
      const { data: newGame, error } = await supabase
        .from('games')
        .insert([
          {
            status: 'lobby',
            red_team_size: 1,
            blue_team_size: 1
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

  const endGame = async (winner: 'red' | 'blue', redScore: number, blueScore: number) => {
    if (!game || game.status === 'played') {
      console.log('Game already ended or no game available')
      return
    }

    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          status: 'played',
          winner: winner,
          red_score: redScore,
          blue_score: blueScore
        })
        .eq('id', game.id)
        .eq('status', 'playing') // Only update if still playing to prevent duplicate submissions

      if (error) {
        console.error('Error ending game:', error)
        alert('Failed to submit game result. Please try again.')
        return
      }

      setGame({ ...game, status: 'played', winner: winner, red_score: redScore, blue_score: blueScore })
      console.log(`Game ended. ${winner} team wins! Final score: Red ${redScore} - Blue ${blueScore}`)
      
      // Show success message and redirect to main page
      alert(`Game completed! ${winner.charAt(0).toUpperCase() + winner.slice(1)} team wins! Final score: Red ${redScore} - Blue ${blueScore}`)
      
      // Redirect to dashboard after showing the result
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
    } catch (error) {
      console.error('Error ending game:', error)
      alert('Failed to submit game result. Please try again.')
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

  // Effect to load game when user changes
  useEffect(() => {
    if (user) {
      ensureProfileExists()
    }
  }, [user, ensureProfileExists])

  // Real-time subscription to game updates
  useEffect(() => {
    if (!game) return

    const channel = supabase
      .channel(`game-${game.id}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'games', 
          filter: `id=eq.${game.id}` 
        }, 
        (payload) => {
          console.log('Game updated:', payload.new)
          const updatedGame = payload.new as Game
          setGame(updatedGame)
          
          // If game just ended, show result and redirect
          if (updatedGame.status === 'played' && updatedGame.winner && updatedGame.red_score !== undefined && updatedGame.blue_score !== undefined) {
            alert(`Game completed! ${updatedGame.winner.charAt(0).toUpperCase() + updatedGame.winner.slice(1)} team wins! Final score: Red ${updatedGame.red_score} - Blue ${updatedGame.blue_score}`)
            setTimeout(() => {
              window.location.href = '/dashboard'
            }, 2000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [game])

  const canStartGame = game && 
    game.status === 'lobby' && 
    players.length >= 1

  // Debug logging for start game conditions
  console.log('Start Game Debug:', {
    gameExists: !!game,
    gameStatus: game?.status,
    redTeamPlayers: players.filter(p => p.team === 'red').length,
    redTeamRequired: game?.red_team_size || 1,
    blueTeamPlayers: players.filter(p => p.team === 'blue').length,
    blueTeamRequired: game?.blue_team_size || 1,
    canStart: canStartGame
  })

  const redTeamFull = players.filter(p => p.team === 'red').length >= (game?.red_team_size || 1)
  const blueTeamFull = players.filter(p => p.team === 'blue').length >= (game?.blue_team_size || 1)
  const teamsBalanced = redTeamFull && blueTeamFull

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
          
          {/* Show final scores if game is finished */}
          {game?.status === 'played' && game.red_score !== undefined && game.blue_score !== undefined && (
            <div className="mt-4 p-4 bg-white/60 backdrop-blur-md rounded-xl border border-lambdaliga-secondary">
              <h4 className="text-lg font-semibold text-lambdaliga-primary mb-2">Final Score</h4>
              <div className="flex justify-center items-center space-x-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{game.red_score}</div>
                  <div className="text-sm text-red-600">Red Team</div>
                </div>
                <div className="text-3xl font-bold text-gray-400">-</div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{game.blue_score}</div>
                  <div className="text-sm text-blue-600">Blue Team</div>
                </div>
              </div>
              {game.winner && (
                <div className="mt-2 text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold text-white ${
                    game.winner === 'red' ? 'bg-red-500' : 'bg-blue-500'
                  }`}>
                    {game.winner.charAt(0).toUpperCase() + game.winner.slice(1)} Team Wins!
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Game ID */}
        <div className="text-center mb-8 text-gray-600">
          Game ID: {game?.id}
        </div>

        {/* Team Size Selection - Only show in lobby */}
        {game?.status === 'lobby' && (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-lambdaliga-secondary mb-8">
            <h3 className="text-xl font-bold text-lambdaliga-primary mb-4 text-center">Team Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Red Team Size */}
              <div className="text-center">
                <label className="block text-red-600 font-semibold mb-2">Red Team Size</label>
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => updateTeamSize('red', 1)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      (game?.red_team_size || 1) === 1 
                        ? 'bg-red-500 text-white' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    1 Player
                  </button>
                  <button
                    onClick={() => updateTeamSize('red', 2)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      (game?.red_team_size || 1) === 2 
                        ? 'bg-red-500 text-white' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    2 Players
                  </button>
                </div>
              </div>

              {/* Blue Team Size */}
              <div className="text-center">
                <label className="block text-blue-600 font-semibold mb-2">Blue Team Size</label>
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => updateTeamSize('blue', 1)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      (game?.blue_team_size || 1) === 1 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    1 Player
                  </button>
                  <button
                    onClick={() => updateTeamSize('blue', 2)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      (game?.blue_team_size || 1) === 2 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    2 Players
                  </button>
                </div>
              </div>
            </div>

            {/* ELO Ranking Message */}
            {!teamsBalanced && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-yellow-800 font-medium">
                    Game will be ranked with the ELO of an average player due to unbalanced teams
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teams Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Red Team */}
          <div className="bg-white/80 backdrop-blur-md border-2 border-red-500 rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-red-600 mb-4 text-center">Red Team</h2>
            <div className="text-center mb-3">
              <span className="text-sm text-red-600 bg-red-100 px-3 py-1 rounded-full">
                {players.filter(p => p.team === 'red').length}/{game?.red_team_size || 1} Players
              </span>
            </div>
            <div className="space-y-3">
              {players.filter(p => p.team === 'red').map((player, index) => (
                <div key={player.id} className="bg-red-100 border border-red-300 p-3 rounded-xl text-center text-red-800 font-medium">
                  {player.username}
                </div>
              ))}
              {players.filter(p => p.team === 'red').length === 0 && (
                <div className="text-red-400 text-center py-6">No players</div>
              )}
              {players.filter(p => p.team === 'red').length < (game?.red_team_size || 1) && game?.status === 'lobby' && (
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
            <div className="text-center mb-3">
              <span className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                {players.filter(p => p.team === 'blue').length}/{game?.blue_team_size || 1} Players
              </span>
            </div>
            <div className="space-y-3">
              {players.filter(p => p.team === 'blue').map((player, index) => (
                <div key={player.id} className="bg-blue-100 border border-blue-300 p-3 rounded-xl text-center text-blue-800 font-medium">
                  {player.username}
                </div>
              ))}
              {players.filter(p => p.team === 'blue').length === 0 && (
                <div className="text-blue-400 text-center py-6">No players</div>
              )}
              {players.filter(p => p.team === 'blue').length < (game?.blue_team_size || 1) && game?.status === 'lobby' && (
                !isPlayerInGame ? (
                  <Button
                    onClick={() => joinTeam('blue')}
                    disabled={joiningTeam === 'blue'}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600"
                  >
                    {joiningTeam === 'blue' ? 'Joining...' : 'Join Blue Team'}
                  </Button>
                ) : playerTeam === 'red' ? (
                  <Button
                    onClick={() => joinTeam('blue')}
                    disabled={joiningTeam === 'blue'}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600"
                  >
                    {joiningTeam === 'blue' ? 'Switching...' : 'Switch to Blue Team'}
                  </Button>
                ) : playerTeam === 'blue' ? (
                  <div className="text-center py-2 px-4 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 font-medium">
                    You are here
                  </div>
                ) : null
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
          {/* Start Game Button - Always show in lobby with status */}
          {game?.status === 'lobby' && (
            <div className="w-full text-center">
              {canStartGame ? (
                <Button
                  onClick={startGame}
                  className="bg-lambdaliga-primary hover:bg-lambdaliga-accent text-white px-8 py-3 text-lg border-lambdaliga-primary hover:border-lambdaliga-accent"
                >
                  🚀 Start Game
                </Button>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-yellow-800 font-medium">
                      Need at least 1 player to start
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-yellow-700 text-center">
                    Total Players: {players.length}
                  </div>
                </div>
              )}
            </div>
          )}

          {game?.status === 'playing' && (
            <GameResultSubmission onGameEnd={endGame} />
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
                // Always create a new game when clicking "New Game"
                console.log('Creating new game from New Game button...')
                await createNewGame()
              }}
              className="bg-lambdaliga-primary hover:bg-lambdaliga-accent text-white px-8 py-3 text-lg border-lambdaliga-primary hover:border-lambdaliga-accent"
            >
              New Game
            </Button>
          )}

          {/* Always show a "Start New Game" button for easy access */}
          <Button
            onClick={async () => {
              console.log('Creating new game from Start New Game button...')
              await createNewGame()
            }}
            variant="outline"
            className="bg-white hover:bg-gray-50 text-lambdaliga-primary border-lambdaliga-primary hover:border-lambdaliga-accent px-6 py-2 text-sm"
          >
            Start New Game
          </Button>
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
