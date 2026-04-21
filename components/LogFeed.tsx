'use client'

import { useEffect, useState } from 'react'

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `${totalSeconds}s`
  return `${minutes}m ${seconds}s`
}

export default function LogFeed({ logs }: { logs: any[] }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  const getRepeatDuration = (log: any, index: number) => {
    if (log.repeats <= 1) return null
    const end = index === 0 ? now : log.lastTimestamp
    return formatDuration(end - log.firstTimestamp)
  }

  return (
    <div className="bg-surface-container-low rounded-lg p-6 h-72 overflow-y-auto flex flex-col-reverse font-mono text-xs text-on-surface-variant border border-outline-variant/10 shadow-inner">
      {logs.map((log: any, i: number) => {
        const repeatDuration = getRepeatDuration(log, i)

        return (
        <div key={log.id} className={`py-1.5 border-t border-outline-variant/10 first:border-t-0 ${log.type === 'error' ? 'text-error font-medium' : ''}`}>
          <span className="text-outline mr-3">[{new Date(log.firstTimestamp).toLocaleTimeString()}]</span>
          {log.type === 'api_call' && (
            <span className="text-secondary font-bold mr-2">Locus API: {log.method} {log.endpoint}</span>
          )}
          {log.type === 'log' && (
            <span className="text-on-surface-variant">{log.message}</span>
          )}
          {log.type === 'error' && (
            <span>{log.message}</span>
          )}
          {log.repeats > 1 && (
            <span className="ml-3 inline-flex items-center gap-2 rounded-full bg-surface px-2 py-0.5 text-[11px] text-outline">
              <span>{log.repeats}x</span>
              {repeatDuration && <span>{repeatDuration}</span>}
            </span>
          )}
        </div>
      )})}
    </div>
  )
}
