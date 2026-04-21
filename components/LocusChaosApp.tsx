'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ScenarioRow from '@/components/ScenarioRow'
import LogFeed from '@/components/LogFeed'
import ScoreCard from '@/components/ScoreCard'

function createScenarioState() {
  return {
    cold_kill: { label: 'Cold Kill', status: 'queued', metric: null, detail: null },
    flood: { label: 'Traffic Flood', status: 'queued', metric: null, detail: null },
    env_corrupt: { label: 'Env Corruption', status: 'queued', metric: null, detail: null },
    db_drop: { label: 'DB Drop', status: 'queued', metric: null, detail: null },
    bad_deploy: { label: 'Bad Deploy', status: 'queued', metric: null, detail: null },
  }
}

function createLogEntry(event: any) {
  const timestamp = Date.now()

  return {
    ...event,
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    firstTimestamp: timestamp,
    lastTimestamp: timestamp,
    repeats: 1,
  }
}

function isRepeatLog(previous: any, next: any) {
  if (!previous || previous.type !== next.type) return false

  if (next.type === 'api_call') {
    return previous.method === next.method && previous.endpoint === next.endpoint
  }

  return previous.message === next.message
}

function formatAvatarName(name?: string | null, email?: string | null) {
  return (name || email || 'User').slice(0, 1).toUpperCase()
}

export default function LocusChaosApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id

  const [repoUrl, setRepoUrl] = useState('')
  const [envVars, setEnvVars] = useState('')
  const [status, setStatus] = useState<'idle' | 'deploying' | 'running' | 'done'>('idle')
  const [scenarios, setScenarios] = useState<Record<string, any>>(createScenarioState)
  const [logs, setLogs] = useState<any[]>([])
  const [score, setScore] = useState<any>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [completedRunId, setCompletedRunId] = useState<string | null>(null)
  const [hasAttemptedResume, setHasAttemptedResume] = useState(false)
  const eventSource = useRef<EventSource | null>(null)

  const appendLog = (event: any) => {
    setLogs((prev) => {
      const nextLog = createLogEntry(event)
      const latestLog = prev[0]

      if (isRepeatLog(latestLog, nextLog)) {
        return [
          {
            ...latestLog,
            timestamp: nextLog.timestamp,
            lastTimestamp: nextLog.timestamp,
            repeats: latestLog.repeats + 1,
          },
          ...prev.slice(1),
        ]
      }

      return [nextLog, ...prev]
    })
  }

  const closeStream = () => {
    if (eventSource.current) {
      eventSource.current.close()
      eventSource.current = null
    }
  }

  const resetRunUi = (nextRepoUrl?: string) => {
    setStatus('deploying')
    setScenarios(createScenarioState())
    setScore(null)
    setCompletedRunId(null)
    setLogs([
      createLogEntry({
        type: 'log',
        message: nextRepoUrl ? `Preparing run for ${nextRepoUrl}...` : 'Preparing run...',
      }),
    ])
  }

  const connectToRun = (runId: string, options?: { nextRepoUrl?: string; resume?: boolean }) => {
    closeStream()
    setActiveRunId(runId)

    if (options?.nextRepoUrl) {
      setRepoUrl(options.nextRepoUrl)
    }

    if (options?.resume) {
      setStatus('deploying')
      setCompletedRunId(null)
      appendLog({ type: 'log', message: `Reconnected to in-progress run ${runId}.` })
    }

    const streamUrl = new URL('/api/stream', window.location.origin)
    streamUrl.searchParams.set('runId', runId)

    const es = new EventSource(streamUrl.toString())
    eventSource.current = es

    es.onmessage = (message) => {
      const event = JSON.parse(message.data)

      if (event.type === 'log' || event.type === 'api_call' || event.type === 'error') {
        appendLog(event)
      }

      if (event.type === 'scenario_start') {
        setStatus('running')
        setScenarios((prev) => ({
          ...prev,
          [event.scenario]: { ...prev[event.scenario], status: 'running' },
        }))
      }

      if (event.type === 'scenario_result') {
        setScenarios((prev) => ({
          ...prev,
          [event.scenario]: {
            ...prev[event.scenario],
            status: event.passed ? 'passed' : 'failed',
            detail: event.detail,
          },
        }))
      }

      if (event.type === 'metric') {
        setScenarios((prev) => ({
          ...prev,
          [event.scenario]: { ...prev[event.scenario], metric: event.value },
        }))
      }

      if (event.type === 'score') {
        setScore(event)
      }

      if (event.type === 'done') {
        setStatus('done')
        setCompletedRunId(runId)
        closeStream()
      }
    }

    es.onerror = () => {
      es.close()
      appendLog({ type: 'error', message: 'Live run connection dropped. Reload to reconnect.' })
    }
  }

  const handleRun = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!repoUrl) return

    if (!sessionUserId) {
      router.push('/login')
      return
    }

    let parsedEnvVars = {}

    if (envVars.trim()) {
      try {
        parsedEnvVars = JSON.parse(envVars)
      } catch {
        setLogs([createLogEntry({ type: 'error', message: 'Environment variables must be valid JSON.' })])
        return
      }
    }

    resetRunUi(repoUrl)

    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, envVars: parsedEnvVars }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setStatus('idle')
      setLogs([
        createLogEntry({
          type: 'error',
          message: data.error || 'Unable to start chaos run.',
        }),
      ])
      return
    }

    router.replace(`/?runId=${data.runId}`)
    connectToRun(data.runId, { nextRepoUrl: repoUrl })
  }

  useEffect(() => {
    return () => {
      closeStream()
    }
  }, [])

  useEffect(() => {
    const runIdFromUrl = searchParams.get('runId')

    if (sessionStatus !== 'authenticated' || hasAttemptedResume) return

    let cancelled = false

    const resumeRun = async () => {
      const response = await fetch('/api/runs?limit=10')

      if (!response.ok || cancelled) {
        setHasAttemptedResume(true)
        return
      }

      const runs = await response.json()
      const targetedRun = runIdFromUrl ? runs.find((run: any) => run.id === runIdFromUrl) : null
      const runToResume = targetedRun?.status === 'running'
        ? targetedRun
        : runs.find((run: any) => run.status === 'running')

      if (runToResume && activeRunId !== runToResume.id) {
        setRepoUrl(runToResume.repoUrl)
        setStatus('deploying')
        connectToRun(runToResume.id, {
          nextRepoUrl: runToResume.repoUrl,
          resume: true,
        })
      }

      if (targetedRun?.status === 'done') {
        setCompletedRunId(targetedRun.id)
        setRepoUrl(targetedRun.repoUrl)
      }

      setHasAttemptedResume(true)
    }

    resumeRun()

    return () => {
      cancelled = true
    }
  }, [activeRunId, hasAttemptedResume, searchParams, sessionStatus])

  const isBusy = status === 'deploying' || status === 'running'

  return (
    <>
      <Sidebar activePath="/" />

      <main className="ml-0 md:ml-64 flex-1 h-full flex flex-col p-6 md:p-8 gap-8 overflow-y-auto bg-surface relative z-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-headline font-black text-3xl md:text-4xl tracking-tight text-on-surface">LocusChaos</h1>
            <p className="font-body text-sm md:text-base text-on-surface-variant mt-2">Break your app before production does.</p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {session?.user ? (
              <>
                <Link href="/dashboard" className="px-4 py-2 rounded-lg border border-outline-variant/20 text-sm font-medium text-on-surface hover:border-primary-container/40 hover:text-primary-container transition-colors">
                  Dashboard
                </Link>
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-body font-semibold">
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.user.image} alt={session.user.name ?? 'User avatar'} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span>{formatAvatarName(session.user.name, session.user.email)}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="px-4 py-2 rounded-lg bg-surface-container-lowest text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="px-4 py-2 rounded-lg bg-primary-container text-sm font-medium text-on-primary hover:bg-primary transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col xl:flex-row gap-8">
          <div className="w-full xl:w-[44%] flex flex-col justify-center max-w-xl">
            <form className="space-y-8 bg-surface-container-lowest/80 backdrop-blur-xl p-8 rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] border border-outline-variant/20" onSubmit={handleRun}>
              <div className="space-y-2">
                <label className="block font-label font-medium text-sm text-on-surface uppercase tracking-wider" htmlFor="github_url">GitHub Repo URL</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="link">link</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest rounded border border-outline-variant/40 focus:ring-0 focus:border-primary-container focus:border-2 border-2 border-transparent text-on-surface font-body outline-none transition-colors"
                    id="github_url"
                    placeholder="https://github.com/org/repo"
                    type="url"
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block font-label font-medium text-sm text-on-surface uppercase tracking-wider" htmlFor="env_vars">Environment Variables (JSON)</label>
                <textarea
                  className="w-full p-4 bg-surface-container-lowest rounded border border-outline-variant/40 focus:ring-0 focus:border-primary-container focus:border-2 border-2 border-transparent text-on-surface font-body outline-none transition-colors font-mono text-sm"
                  id="env_vars"
                  placeholder='{"API_URL": "https://api.example.com", "SECRET_KEY": "secret"}'
                  rows={5}
                  value={envVars}
                  onChange={(event) => setEnvVars(event.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isBusy || !repoUrl}
                  className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-body text-base font-medium py-4 rounded-lg flex items-center justify-center gap-2 hover:shadow-[0_20px_40px_rgba(27,0,99,0.12)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" data-icon="science">science</span>
                  {isBusy ? (status === 'running' ? 'Chaos Suite Running...' : 'Deploying...') : 'Run Chaos Suite'}
                </button>

                {completedRunId && (
                  <Link href={`/runs/${completedRunId}`} className="text-sm font-medium text-primary-container hover:text-primary transition-colors">
                    View full report →
                  </Link>
                )}
              </div>
            </form>
          </div>

          <div className={`w-full xl:w-[56%] h-full flex flex-col bg-surface-container-low rounded-2xl relative ${status === 'idle' ? 'overflow-hidden border border-outline-variant/10' : 'p-6 space-y-6 overflow-y-auto'}`}>
            {status === 'idle' ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 text-center flex-col gap-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center shadow-[0_12px_40px_rgba(27,0,99,0.06)]">
                  <span className="material-symbols-outlined text-4xl text-outline-variant" data-icon="target">my_location</span>
                </div>
                <h3 className="font-headline text-xl text-on-surface-variant">Awaiting target...</h3>
                <p className="font-body text-sm text-outline max-w-sm">
                  {session?.user ? 'Connect a repository to launch a tracked chaos run.' : 'Sign in with GitHub to start tracked chaos runs and keep a history of reports.'}
                </p>
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary-fixed-dim/20 rounded-full blur-3xl -mr-20 -mb-20 pointer-events-none"></div>
              </div>
            ) : (
              <>
                <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] p-6 flex flex-col gap-6">
                  {Object.keys(scenarios).map((key) => (
                    <ScenarioRow key={key} scenario={key} {...scenarios[key]} />
                  ))}
                </div>

                <div className="flex-1 min-h-[320px] bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] p-6 flex flex-col">
                  <LogFeed logs={logs} />
                </div>

                {score && (
                  <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_40px_rgba(27,0,99,0.06)] p-6">
                    <ScoreCard scoreData={score} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
