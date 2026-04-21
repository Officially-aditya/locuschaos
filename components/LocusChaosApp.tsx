'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ScenarioRow from '@/components/ScenarioRow'
import LogFeed from '@/components/LogFeed'
import ScoreCard from '@/components/ScoreCard'
import { APP_SETTINGS_STORAGE_KEY, DEFAULT_APP_SETTINGS, ENV_DRAFT_STORAGE_KEY } from '@/lib/app-settings'

function createEnvRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: '',
    value: '',
    revealValue: false,
  }
}

function createEnvRowWithValues(key = '', value = '') {
  return {
    ...createEnvRow(),
    key,
    value,
  }
}

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
  const timestamp = event.timestamp ?? Date.now()

  return {
    ...event,
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    firstTimestamp: timestamp,
    lastTimestamp: timestamp,
    repeats: 1,
  }
}

function appendLogEntry(previousLogs: any[], event: any) {
  const nextLog = createLogEntry(event)
  const latestLog = previousLogs[0]

  if (isRepeatLog(latestLog, nextLog)) {
    return [
      {
        ...latestLog,
        timestamp: nextLog.timestamp,
        lastTimestamp: nextLog.timestamp,
        repeats: latestLog.repeats + 1,
      },
      ...previousLogs.slice(1),
    ]
  }

  return [nextLog, ...previousLogs]
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

function normalizeEnvValue(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  const inlineCommentIndex = trimmed.search(/\s+#/)

  if (inlineCommentIndex !== -1) {
    return trimmed.slice(0, inlineCommentIndex).trim()
  }

  return trimmed
}

function parseEnvPaste(text: string) {
  const parsedRows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/^export\s+/, ''))
    .map((line) => {
      const separatorIndex = line.indexOf('=')

      if (separatorIndex <= 0) return null

      const key = line.slice(0, separatorIndex).trim()
      const value = normalizeEnvValue(line.slice(separatorIndex + 1))

      if (!key) return null

      return createEnvRowWithValues(key, value)
    })
    .filter(Boolean)

  return parsedRows.length > 0 ? parsedRows : null
}

function isRecord(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function buildLogsFromStoredEvents(events: any) {
  if (!Array.isArray(events)) {
    return []
  }

  return events.reduce((nextLogs, event) => appendLogEntry(nextLogs, event), [])
}

function createScenarioStateFromRun(run: any) {
  const nextScenarios = createScenarioState()
  const results = isRecord(run?.results) ? run.results : {}
  const verdicts = isRecord(run?.verdicts) ? run.verdicts : {}

  Object.keys(nextScenarios).forEach((key) => {
    if (!(key in results)) {
      return
    }

    nextScenarios[key] = {
      ...nextScenarios[key],
      status: results[key] ? 'passed' : 'failed',
      detail: verdicts[key] ?? null,
    }
  })

  if (run?.status === 'error' && verdicts.error) {
    const firstScenarioKey = Object.keys(nextScenarios).find((key) => nextScenarios[key].status === 'queued')

    if (firstScenarioKey) {
      nextScenarios[firstScenarioKey] = {
        ...nextScenarios[firstScenarioKey],
        status: 'failed',
        detail: verdicts.error,
      }
    }
  }

  return nextScenarios
}

function createScoreFromRun(run: any) {
  if (!run?.grade || typeof run?.points !== 'number') {
    return null
  }

  return {
    grade: run.grade,
    points: run.points,
    total: 100,
    verdicts: isRecord(run.verdicts) ? run.verdicts : {},
  }
}

function getUiStatusFromRun(run: any) {
  if (!run) {
    return 'idle'
  }

  if (run.status === 'running') {
    return isRecord(run.results) && Object.keys(run.results).length > 0 ? 'running' : 'deploying'
  }

  if (run.status === 'error') {
    return 'error'
  }

  return 'done'
}

export default function LocusChaosApp({ activePath = '/' }: { activePath?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id

  const [repoUrl, setRepoUrl] = useState('')
  const [envRows, setEnvRows] = useState([createEnvRow()])
  const [status, setStatus] = useState<'idle' | 'deploying' | 'running' | 'done' | 'error'>('idle')
  const [scenarios, setScenarios] = useState<Record<string, any>>(createScenarioState)
  const [logs, setLogs] = useState<any[]>([])
  const [score, setScore] = useState<any>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [completedRunId, setCompletedRunId] = useState<string | null>(null)
  const [hasAttemptedResume, setHasAttemptedResume] = useState(false)
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS)
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const eventSource = useRef<EventSource | null>(null)
  const reconnectTimeout = useRef<number | null>(null)
  const isBusy = status === 'deploying' || status === 'running'

  const appendLog = (event: any) => {
    setLogs((prev) => appendLogEntry(prev, event))
  }

  const closeStream = () => {
    if (eventSource.current) {
      eventSource.current.close()
      eventSource.current = null
    }

    if (reconnectTimeout.current) {
      window.clearTimeout(reconnectTimeout.current)
      reconnectTimeout.current = null
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

  const applyPersistedRun = (run: any) => {
    closeStream()
    setActiveRunId(run.id)
    setRepoUrl(run.repoUrl ?? '')
    setStatus(getUiStatusFromRun(run))
    setScenarios(createScenarioStateFromRun(run))
    setLogs(buildLogsFromStoredEvents(run.logEvents))
    setScore(createScoreFromRun(run))
    setCompletedRunId(run.status === 'running' ? null : run.id)
  }

  const fetchRunDetails = async (runId: string) => {
    const response = await fetch(`/api/runs/${runId}`, { cache: 'no-store' })

    if (!response.ok) {
      return null
    }

    return response.json()
  }

  const updateEnvRow = (rowId: string, field: 'key' | 'value', nextValue: string) => {
    setEnvRows((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, [field]: nextValue } : row
    )))
  }

  const toggleEnvValueVisibility = (rowId: string) => {
    setEnvRows((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, revealValue: !row.revealValue } : row
    )))
  }

  const addEnvRow = () => {
    setEnvRows((prev) => [...prev, createEnvRow()])
  }

  const insertParsedEnvRows = (targetRowId: string, parsedRows: Array<ReturnType<typeof createEnvRow>>) => {
    setEnvRows((prev) => {
      const targetIndex = prev.findIndex((row) => row.id === targetRowId)

      if (targetIndex === -1) {
        return [...prev, ...parsedRows]
      }

      return [
        ...prev.slice(0, targetIndex),
        ...parsedRows,
        ...prev.slice(targetIndex + 1),
      ]
    })
  }

  const removeEnvRow = (rowId: string) => {
    setEnvRows((prev) => {
      if (prev.length === 1) {
        return [{ ...prev[0], key: '', value: '' }]
      }

      return prev.filter((row) => row.id !== rowId)
    })
  }

  const buildEnvObject = () => {
    const nextEnvVars: Record<string, string> = {}
    const seenKeys = new Set<string>()

    for (const row of envRows) {
      const key = row.key.trim()
      const value = row.value

      if (!key && !value.trim()) {
        continue
      }

      if (!key || !value.trim()) {
        throw new Error('Each environment row needs both a key and a value.')
      }

      if (seenKeys.has(key)) {
        throw new Error(`Duplicate environment key: ${key}`)
      }

      seenKeys.add(key)
      nextEnvVars[key] = value
    }

    return nextEnvVars
  }

  const handleEnvPaste = (rowId: string, pastedText: string) => {
    const parsedRows = parseEnvPaste(pastedText)

    if (!parsedRows) {
      return false
    }

    insertParsedEnvRows(rowId, parsedRows)
    return true
  }

  const connectToRun = (runId: string, options?: { nextRepoUrl?: string; resume?: boolean }) => {
    closeStream()
    setActiveRunId(runId)

    if (options?.nextRepoUrl) {
      setRepoUrl(options.nextRepoUrl)
    }

    if (options?.resume) {
      setStatus((currentStatus) => currentStatus === 'running' ? 'running' : 'deploying')
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

    es.onerror = async () => {
      es.close()
      eventSource.current = null

      const latestRun = await fetchRunDetails(runId)

      if (!latestRun) {
        appendLog({ type: 'error', message: 'Live run connection dropped. We could not reload the latest run state.' })
        return
      }

      if (latestRun.status === 'running') {
        applyPersistedRun(latestRun)
        appendLog({ type: 'log', message: 'Live run connection dropped. Reconnecting…' })
        reconnectTimeout.current = window.setTimeout(() => {
          connectToRun(runId, {
            nextRepoUrl: latestRun.repoUrl,
            resume: true,
          })
        }, 1500)
        return
      }

      applyPersistedRun(latestRun)
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

    try {
      parsedEnvVars = buildEnvObject()
    } catch (error: any) {
      setLogs([createLogEntry({ type: 'error', message: error.message })])
      return
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

    router.replace(`/new-run?runId=${data.runId}`)
    connectToRun(data.runId, { nextRepoUrl: repoUrl })
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
      const nextSettings = stored ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(stored) } : DEFAULT_APP_SETTINGS

      setAppSettings(nextSettings)

      if (!repoUrl && nextSettings.defaultRepoUrl) {
        setRepoUrl(nextSettings.defaultRepoUrl)
      }

      if (nextSettings.persistEnvDraft) {
        const savedDraft = window.localStorage.getItem(ENV_DRAFT_STORAGE_KEY)

        if (savedDraft) {
          const parsedRows = JSON.parse(savedDraft)

          if (Array.isArray(parsedRows) && parsedRows.length > 0) {
            setEnvRows(parsedRows)
          }
        }
      }
    } catch {}

    setHasLoadedSettings(true)
  }, [])

  useEffect(() => {
    return () => {
      closeStream()
    }
  }, [])

  useEffect(() => {
    const runIdFromUrl = searchParams.get('runId')

    if (sessionStatus !== 'authenticated' || hasAttemptedResume || !hasLoadedSettings || !appSettings.autoResumeRuns) return

    let cancelled = false

    const resumeRun = async () => {
      if (!runIdFromUrl) {
        setHasAttemptedResume(true)
        return
      }

      const targetedRun = await fetchRunDetails(runIdFromUrl)

      if (cancelled) {
        return
      }

      if (!targetedRun) {
        setHasAttemptedResume(true)
        return
      }

      applyPersistedRun(targetedRun)

      if (targetedRun.status === 'running' && activeRunId !== targetedRun.id) {
        connectToRun(targetedRun.id, {
          nextRepoUrl: targetedRun.repoUrl,
          resume: true,
        })
      }

      setHasAttemptedResume(true)
    }

    resumeRun()

    return () => {
      cancelled = true
    }
  }, [activeRunId, appSettings.autoResumeRuns, hasAttemptedResume, hasLoadedSettings, searchParams, sessionStatus])

  useEffect(() => {
    const runIdFromUrl = searchParams.get('runId')

    if (runIdFromUrl || isBusy) {
      return
    }

    closeStream()
    setActiveRunId(null)
    setCompletedRunId(null)
    setStatus('idle')
    setScenarios(createScenarioState())
    setScore(null)
    setLogs([])
    setHasAttemptedResume(false)
  }, [isBusy, searchParams, status])

  useEffect(() => {
    if (!hasLoadedSettings) return

    if (appSettings.persistEnvDraft) {
      window.localStorage.setItem(ENV_DRAFT_STORAGE_KEY, JSON.stringify(envRows))
      return
    }

    window.localStorage.removeItem(ENV_DRAFT_STORAGE_KEY)
  }, [appSettings.persistEnvDraft, envRows, hasLoadedSettings])

  return (
    <>
      <Sidebar activePath={activePath} />

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
                <div className="flex items-center justify-between gap-4">
                  <label className="block font-label font-medium text-sm text-on-surface uppercase tracking-wider" htmlFor="env_key_0">Environment Variables</label>
                  <button
                    type="button"
                    onClick={addEnvRow}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 px-3 py-2 text-xs font-medium text-primary-container hover:border-primary-container/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Add Row
                  </button>
                </div>

                <div className="rounded-xl border border-outline-variant/20 overflow-hidden">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_72px] bg-surface-container-low px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    <span>Env Key</span>
                    <span>Secret Value</span>
                    <span className="text-right">Action</span>
                  </div>

                  <div className="divide-y divide-outline-variant/10">
                    {envRows.map((row, index) => (
                      <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_72px] gap-3 bg-surface-container-lowest px-4 py-3">
                        <input
                          id={`env_key_${index}`}
                          className="min-w-0 rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary-container"
                          placeholder="API_KEY"
                          value={row.key}
                          onChange={(event) => updateEnvRow(row.id, 'key', event.target.value)}
                          onPaste={(event) => {
                            if (handleEnvPaste(row.id, event.clipboardData.getData('text'))) {
                              event.preventDefault()
                            }
                          }}
                          disabled={isBusy}
                        />
                        <div className="relative min-w-0">
                          <input
                            type={row.revealValue ? 'text' : 'password'}
                            className="w-full min-w-0 rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 pr-11 text-sm text-on-surface outline-none transition-colors focus:border-primary-container"
                            placeholder="secret value"
                            value={row.value}
                            onChange={(event) => updateEnvRow(row.id, 'value', event.target.value)}
                            onPaste={(event) => {
                              if (handleEnvPaste(row.id, event.clipboardData.getData('text'))) {
                                event.preventDefault()
                              }
                            }}
                            disabled={isBusy}
                          />
                          <button
                            type="button"
                            onClick={() => toggleEnvValueVisibility(row.id)}
                            disabled={isBusy}
                            className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-outline hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label={row.revealValue ? `Hide value for environment row ${index + 1}` : `Show value for environment row ${index + 1}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {row.revealValue ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => removeEnvRow(row.id)}
                            disabled={isBusy}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-outline hover:bg-surface hover:text-error disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Remove environment row ${index + 1}`}
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
