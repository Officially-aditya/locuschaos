'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { APP_SETTINGS_STORAGE_KEY, DEFAULT_APP_SETTINGS, ENV_DRAFT_STORAGE_KEY } from '@/lib/app-settings'

function Toggle({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean
  label: string
  description: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 cursor-pointer">
      <div className="space-y-1">
        <div className="font-body font-medium text-on-surface">{label}</div>
        <div className="text-sm text-on-surface-variant">{description}</div>
      </div>
      <span className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary-container' : 'bg-outline-variant/30'}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
        />
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </label>
  )
}

export default function SettingsForm() {
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS)
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    const stored = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)

    if (!stored) return

    try {
      const parsed = JSON.parse(stored)
      setSettings({ ...DEFAULT_APP_SETTINGS, ...parsed })
    } catch {}
  }, [])

  const updateSetting = (key: keyof typeof DEFAULT_APP_SETTINGS, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSavedMessage('')
  }

  const handleSave = () => {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))

    if (!settings.persistEnvDraft) {
      window.localStorage.removeItem(ENV_DRAFT_STORAGE_KEY)
    }

    setSavedMessage('Saved to this browser.')
  }

  const resetSettings = () => {
    setSettings(DEFAULT_APP_SETTINGS)
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS))
    window.localStorage.removeItem(ENV_DRAFT_STORAGE_KEY)
    setSavedMessage('Reset to defaults.')
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-[0_12px_40px_rgba(27,0,99,0.06)]">
        <div className="space-y-2 mb-6">
          <h2 className="font-headline text-xl font-bold text-on-surface">Deployment Preferences</h2>
          <p className="text-sm text-on-surface-variant">These settings live in your current browser and shape how new runs behave.</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block font-label font-medium text-sm text-on-surface uppercase tracking-wider" htmlFor="default_repo_url">
              Default Repository
            </label>
            <input
              id="default_repo_url"
              type="url"
              value={settings.defaultRepoUrl}
              onChange={(event) => updateSetting('defaultRepoUrl', event.target.value)}
              placeholder="https://github.com/org/repo"
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-on-surface outline-none transition-colors focus:border-primary-container"
            />
            <p className="text-xs text-outline">Pre-fills the main deploy form when you open the app.</p>
          </div>

          <div className="space-y-3">
            <Toggle
              checked={settings.autoResumeRuns}
              onChange={(checked) => updateSetting('autoResumeRuns', checked)}
              label="Auto-resume running deployments"
              description="Reconnect to the latest in-progress run when you return to the home page."
            />
            <Toggle
              checked={settings.persistEnvDraft}
              onChange={(checked) => updateSetting('persistEnvDraft', checked)}
              label="Remember environment variable rows"
              description="Keep your unfinished env table draft in this browser between visits."
            />
            <Toggle
              checked={settings.confirmDestructiveActions}
              onChange={(checked) => updateSetting('confirmDestructiveActions', checked)}
              label="Confirm destructive actions"
              description="Ask before deleting a live project or tearing down an existing service."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-primary-container px-5 py-3 text-sm font-medium text-on-primary hover:bg-primary transition-colors"
            >
              Save Settings
            </button>
            <button
              type="button"
              onClick={resetSettings}
              className="rounded-lg border border-outline-variant/20 px-5 py-3 text-sm font-medium text-on-surface hover:border-primary-container/40 hover:text-primary-container transition-colors"
            >
              Reset
            </button>
            {savedMessage && <span className="text-sm text-on-surface-variant">{savedMessage}</span>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-[0_12px_40px_rgba(27,0,99,0.06)]">
        <div className="space-y-2 mb-4">
          <h2 className="font-headline text-xl font-bold text-on-surface">Session Controls</h2>
          <p className="text-sm text-on-surface-variant">Manage the current browser session without touching your stored run history.</p>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-lg bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface hover:bg-surface transition-colors"
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
