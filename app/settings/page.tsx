import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import SettingsForm from '@/components/SettingsForm'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function SettingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-outline">{label}</div>
      <div className="mt-2 text-lg font-semibold text-on-surface">{value}</div>
    </div>
  )
}

function StatusPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider bg-surface-container-low">
      <span className={`h-2.5 w-2.5 rounded-full ${ready ? 'bg-[#00b34d]' : 'bg-error'}`} />
      <span className={ready ? 'text-[#00b34d]' : 'text-error'}>{label}</span>
    </div>
  )
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!userId) {
    redirect('/login')
  }

  const [totalRuns, activeRuns, tornDownRuns, pointsSummary, latestRun] = await Promise.all([
    prisma.run.count({ where: { userId } }),
    prisma.run.count({ where: { userId, status: 'running' } }),
    prisma.run.count({ where: { userId, status: 'torn_down' } }),
    prisma.run.aggregate({
      where: { userId, points: { not: null } },
      _avg: { points: true },
    }),
    prisma.run.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { repoUrl: true, createdAt: true },
    }),
  ])

  const githubReady = Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim())
  const locusReady = Boolean(process.env.LOCUS_API_KEY?.trim())
  const databaseReady = Boolean(process.env.DATABASE_URL?.trim())

  return (
    <>
      <Sidebar activePath="/settings" />

      <main className="ml-0 md:ml-64 flex-1 h-full overflow-y-auto bg-surface p-6 md:p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="space-y-2">
            <h1 className="font-headline text-3xl font-black tracking-tight text-on-surface">Settings</h1>
            <p className="font-body text-sm text-on-surface-variant">
              Tune how this browser behaves, review your connected workspace health, and manage your signed-in session.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SettingStat label="Signed In As" value={session?.user?.email || session?.user?.name || 'Unknown'} />
            <SettingStat label="Total Runs" value={`${totalRuns}`} />
            <SettingStat label="Active Runs" value={`${activeRuns}`} />
            <SettingStat label="Avg Score" value={pointsSummary._avg.points ? `${Math.round(pointsSummary._avg.points)}/100` : '—'} />
          </section>

          <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-[0_12px_40px_rgba(27,0,99,0.06)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h2 className="font-headline text-xl font-bold text-on-surface">Workspace Health</h2>
                <p className="text-sm text-on-surface-variant">Quick readiness checks for the services this deployment depends on.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label={githubReady ? 'GitHub OAuth Ready' : 'GitHub OAuth Missing'} ready={githubReady} />
                <StatusPill label={locusReady ? 'Locus API Ready' : 'Locus API Missing'} ready={locusReady} />
                <StatusPill label={databaseReady ? 'Database Ready' : 'Database Missing'} ready={databaseReady} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Recent Repo</div>
                <div className="mt-2 text-sm text-on-surface">{latestRun?.repoUrl || 'No runs yet'}</div>
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Last Activity</div>
                <div className="mt-2 text-sm text-on-surface">{latestRun ? new Date(latestRun.createdAt).toLocaleString() : 'No recent activity'}</div>
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Torn Down Runs</div>
                <div className="mt-2 text-sm text-on-surface">{tornDownRuns} cleaned up</div>
              </div>
            </div>
          </section>

          <SettingsForm />
        </div>
      </main>
    </>
  )
}
