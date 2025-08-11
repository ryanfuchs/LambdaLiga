'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/login')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-lambdaliga-light via-lambdaliga-secondary to-lambdaliga-light flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-lambdaliga-primary to-lambdaliga-accent rounded-3xl mb-6 shadow-glow">
          <span className="text-3xl font-bold text-white">LL</span>
        </div>
        <h1 className="text-4xl font-bold text-lambdaliga-primary mb-4">LambdaLiga</h1>
        <p className="text-gray-600 text-lg">Redirecting to login...</p>
      </div>
    </div>
  )
} 