'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getProviders, signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.426 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.866-.013-1.699-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.748-1.027 2.748-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.579.688.481A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { status } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [githubEnabled, setGithubEnabled] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [router, status])

  useEffect(() => {
    let cancelled = false

    const loadProviders = async () => {
      const providers = await getProviders().catch(() => null)

      if (cancelled) return

      setGithubEnabled(Boolean(providers?.github))
      setIsLoading(false)
    }

    loadProviders()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="min-h-screen w-full bg-[#0f0f14] flex items-center justify-center px-6">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-white">
          Locus<span className="text-[#E63946]">Chaos</span>
        </h1>
        <p className="text-gray-400">Break your app before production does.</p>
        <button
          onClick={() => githubEnabled && signIn('github', { callbackUrl: '/dashboard' })}
          disabled={!githubEnabled || isLoading}
          className="flex items-center gap-3 bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GitHubIcon />
          {isLoading ? 'Checking sign-in...' : githubEnabled ? 'Continue with GitHub' : 'GitHub login unavailable'}
        </button>
        {!isLoading && !githubEnabled && (
          <div className="space-y-2">
            <p className="text-sm text-red-300">GitHub OAuth is not configured on this deployment yet.</p>
            <Link href="/" className="text-sm text-gray-300 hover:text-white transition-colors">
              Return to home
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
