'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lambdaliga-light via-lambdaliga-secondary to-lambdaliga-light flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-3xl mb-6 shadow-glow">
            <span className="text-3xl font-bold text-white">LL</span>
          </div>
          <h1 className="text-4xl font-bold text-lambdaliga-primary mb-4">LambdaLiga</h1>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  // Don&apos;t render if not authenticated
  if (!user) {
    return null
  }

  // Get username from user metadata or email
  const username = user.user_metadata?.username || user.email?.split('@')[0] || 'User'

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
              <span className="text-gray-600">Welcome, <span className="font-semibold text-lambdaliga-primary">{username}</span>!</span>
              <Button variant="outline" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-lambdaliga-primary mb-4">
            Welcome to LambdaLiga, {username}! 🎮
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Ready to dominate the competition? Choose your game mode and start your journey to become a legend.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-lambdaliga-secondary">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Games Won</p>
                <p className="text-2xl font-bold text-lambdaliga-primary">24</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-lambdaliga-secondary">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-lambdaliga-accent to-lambdaliga-primary rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold text-lambdaliga-primary">68%</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-lambdaliga-secondary">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Friends</p>
                <p className="text-2xl font-bold text-lambdaliga-primary">156</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-lambdaliga-secondary">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-lambdaliga-accent to-lambdaliga-primary rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Play Time</p>
                <p className="text-2xl font-bold text-lambdaliga-primary">127h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Game Modes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-lambdaliga-secondary hover:border-lambdaliga-primary transition-all duration-300 group">
            <div className="w-16 h-16 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-lambdaliga-primary mb-4">Quick Match</h3>
            <p className="text-gray-600 mb-6">Jump into a fast-paced game and test your skills against players of similar level.</p>
            <Button variant="gradient" fullWidth>
              Play Now
            </Button>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-lambdaliga-secondary hover:border-lambdaliga-primary transition-all duration-300 group">
            <div className="w-16 h-16 bg-gradient-to-r from-lambdaliga-accent to-lambdaliga-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H7a2 2 0 00-2 2v2m14 0V5a2 2 0 00-2-2H7a2 2 0 00-2 2v2" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-lambdaliga-primary mb-4">Tournament</h3>
            <p className="text-gray-600 mb-6">Compete in organized tournaments and climb the leaderboards to earn rewards.</p>
            <Button variant="outline" fullWidth>
              Join Tournament
            </Button>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-lambdaliga-secondary hover:border-lambdaliga-primary transition-all duration-300 group">
            <div className="w-16 h-16 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-lambdaliga-primary mb-4">Team Battle</h3>
            <p className="text-gray-600 mb-6">Form a team with friends and take on other squads in epic team-based battles.</p>
            <Button variant="outline" fullWidth>
              Create Team
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-lambdaliga-secondary">
          <h2 className="text-2xl font-bold text-lambdaliga-primary mb-6">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-lambdaliga-light/50 rounded-xl">
              <div className="w-10 h-10 bg-lambdaliga-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold">W</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">Victory against TeamAlpha</p>
                <p className="text-sm text-gray-600">2 hours ago • Quick Match</p>
              </div>
              <span className="text-lambdaliga-primary font-semibold">+25 XP</span>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-lambdaliga-light/50 rounded-xl">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">L</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">Defeat by ProGamer123</p>
                <p className="text-sm text-gray-600">5 hours ago • Tournament</p>
              </div>
              <span className="text-gray-500 font-semibold">-10 XP</span>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-lambdaliga-light/50 rounded-xl">
              <div className="w-10 h-10 bg-lambdaliga-accent rounded-full flex items-center justify-center">
                <span className="text-white font-bold">T</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">New achievement unlocked</p>
                <p className="text-sm text-gray-600">1 day ago • First Blood</p>
              </div>
              <span className="text-lambdaliga-accent font-semibold">+50 XP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 