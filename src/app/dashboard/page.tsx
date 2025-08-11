'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  username: string
  email: string
  avatar_url: string | null
  created_at: string
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      // Get profile data - the database trigger should have created it
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        // If profile doesn't exist, wait a bit and try again (trigger might be delayed)
        if (error.code === 'PGRST116') {
          setTimeout(async () => {
            const { data: retryProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()
            
            if (retryProfile) {
              setProfile(retryProfile)
            } else {
              // If still no profile, create one manually as fallback
              const { data: fallbackProfile, error: createError } = await supabase
                .from('profiles')
                .insert([
                  {
                    id: user.id,
                    username: user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                    email: user.email,
                    avatar_url: user.user_metadata?.avatar_url || null,
                    created_at: new Date().toISOString(),
                  },
                ])
                .select()
                .single()

              if (createError) {
                console.error('Error creating fallback profile:', createError)
              } else {
                setProfile(fallbackProfile)
              }
            }
            setLoading(false)
          }, 2000) // Wait 2 seconds for trigger
          return
        }
      } else {
        setProfile(profileData)
      }

      setLoading(false)
    }

    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-accent-light text-xl">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-accent-red text-xl">Error loading profile</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-secondary-dark rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-accent-light">
              Welcome, {profile.username}!
            </h1>
            <button
              onClick={handleLogout}
              className="bg-accent-red hover:bg-dark-red text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              Logout
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-accent-dark p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-accent-light mb-4">
                Profile Information
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-300">Username:</span>
                  <span className="ml-2 text-white font-medium">{profile.username}</span>
                </div>
                <div>
                  <span className="text-gray-300">Email:</span>
                  <span className="ml-2 text-white font-medium">{profile.email}</span>
                </div>
                <div>
                  <span className="text-gray-300">Member since:</span>
                  <span className="ml-2 text-white font-medium">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-accent-dark p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-accent-light mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button className="w-full bg-accent-light hover:bg-accent-dark text-dark-bg font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105">
                  Edit Profile
                </button>
                <button className="w-full bg-secondary-dark hover:bg-accent-dark text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105">
                  View Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 