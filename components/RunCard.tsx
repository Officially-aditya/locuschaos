'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function getGradeClasses(grade?: string | null, status?: string) {
  if (status === 'running') return 'bg-surface text-outline animate-pulse'

  const classes: Record<string, string> = {
    A: 'bg-[#e8fff1] text-[#00b34d]',
    B: 'bg-[#e7fbfb] text-[#009f9f]',
    C: 'bg-[#fff8d8] text-[#b48d00]',
    D: 'bg-[#fff0df] text-[#cc6b00]',
    F: 'bg-[#ffe5e8] text-[#e63946]',
  }

  return classes[grade || ''] || 'bg-surface text-outline'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export default function RunCard({ run }: { run: any }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRerun = async () => {
    setIsSubmitting(true)

    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: run.repoUrl, envVars: {} }),
    })

    const data = await response.json().catch(() => ({}))
    setIsSubmitting(false)

    if (!response.ok || !data.runId) return

    router.push(`/?runId=${data.runId}`)
    router.refresh()
  }

  const handleTeardown = async () => {
    setIsSubmitting(true)
    await fetch(`/api/runs/${run.id}/teardown`, { method: 'POST' })
    setIsSubmitting(false)
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_12px_40px_rgba(27,0,99,0.06)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${getGradeClasses(run.grade, run.status)}`}>
              {run.status === 'running' ? 'Running' : run.grade || run.status}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-outline">{run.status}</span>
            <span className="text-xs text-outline">{formatDate(run.createdAt)}</span>
          </div>

          <div>
            <h3 className="font-headline text-xl font-bold text-on-surface">{run.repoUrl}</h3>
            {run.serviceUrl && (
              <a href={run.serviceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-medium text-primary-container hover:text-primary transition-colors">
                {run.serviceUrl}
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-5 text-sm text-on-surface-variant">
            <span>{run.points ?? '—'} points</span>
            <span>{run.completedAt ? `Completed ${formatDate(run.completedAt)}` : 'Still in progress'}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/runs/${run.id}`} className="px-4 py-2 rounded-lg border border-outline-variant/20 text-sm font-medium text-on-surface hover:border-primary-container/40 hover:text-primary-container transition-colors">
            View Report
          </Link>
          <button
            type="button"
            onClick={handleRerun}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-primary-container text-sm font-medium text-on-primary hover:bg-primary transition-colors disabled:opacity-50"
          >
            Re-run Chaos
          </button>
          {run.status === 'done' && run.serviceId && (
            <button
              type="button"
              onClick={handleTeardown}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-error/10 text-sm font-medium text-error hover:bg-error/15 transition-colors disabled:opacity-50"
            >
              Teardown
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
