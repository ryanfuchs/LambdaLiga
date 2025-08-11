'use client'

import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl md:text-8xl font-bold text-accent-light mb-8">
          LambdaLiga
        </h1>
        <button
          onClick={() => router.push('/auth')}
          className="bg-accent-light hover:bg-accent-dark text-dark-bg font-semibold py-4 px-8 rounded-lg text-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
        >
          Sign In
        </button>
      </div>
    </div>
  )
} 