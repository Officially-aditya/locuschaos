import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function formatDate(value?: Date | string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function gradeClasses(grade?: string | null) {
  const classes: Record<string, string> = {
    A: 'text-[#00b34d]',
    B: 'text-primary-container',
    C: 'text-[#b48d00]',
    D: 'text-[#cc6b00]',
    F: 'text-error',
  }

  return classes[grade || ''] || 'text-on-surface'
}

export default async function RunReportPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!userId) {
    redirect('/login')
  }

  const run = await prisma.run.findFirst({
    where: {
      id: params.id,
      userId,
    },
  })

  if (!run) {
    redirect('/dashboard')
  }

  const results = (run.results as Record<string, boolean> | null) ?? {}
  const verdicts = (run.verdicts as Record<string, string> | null) ?? {}

  return (
    <>
      <Sidebar activePath="/dashboard" />

      <main className="ml-0 md:ml-64 flex-1 h-full overflow-y-auto bg-surface p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <Link href="/dashboard" className="inline-flex text-sm font-medium text-primary-container hover:text-primary transition-colors">
                ← Back to dashboard
              </Link>
              <div>
                <h1 className="font-headline text-3xl font-black tracking-tight text-on-surface">Run Report</h1>
                <p className="font-body text-sm text-on-surface-variant mt-2">{run.repoUrl}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low px-6 py-5 text-right shadow-[0_12px_40px_rgba(27,0,99,0.06)]">
              <div className={`font-mono text-6xl font-black tracking-tighter ${gradeClasses(run.grade)}`}>{run.grade || '—'}</div>
              <div className="mt-2 text-sm font-medium text-on-surface-variant">{run.points ?? '—'} points</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6">
              <h2 className="font-headline text-lg font-bold text-on-surface mb-4">Run Metadata</h2>
              <div className="space-y-3 text-sm text-on-surface-variant">
                <div>Status: <span className="text-on-surface">{run.status}</span></div>
                <div>Created: <span className="text-on-surface">{formatDate(run.createdAt)}</span></div>
                <div>Completed: <span className="text-on-surface">{formatDate(run.completedAt)}</span></div>
                <div>Service ID: <span className="text-on-surface">{run.serviceId || '—'}</span></div>
                <div>
                  Service URL:{' '}
                  {run.serviceUrl ? (
                    <a href={run.serviceUrl} target="_blank" rel="noreferrer" className="text-primary-container hover:text-primary transition-colors">
                      {run.serviceUrl}
                    </a>
                  ) : (
                    <span className="text-on-surface">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6">
              <h2 className="font-headline text-lg font-bold text-on-surface mb-4">Verdicts</h2>
              <div className="space-y-3 text-sm text-on-surface-variant">
                {Object.keys(verdicts).length === 0 ? (
                  <p>No verdicts captured.</p>
                ) : (
                  Object.entries(verdicts).map(([key, value]) => (
                    <div key={key}>
                      <div className="font-bold uppercase tracking-wider text-on-surface">{key.replace(/_/g, ' ')}</div>
                      <div className="mt-1 leading-relaxed">{value}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-[0_12px_40px_rgba(27,0,99,0.06)]">
            <h2 className="font-headline text-xl font-bold text-on-surface mb-5">Scenario Breakdown</h2>
            <div className="overflow-hidden rounded-xl border border-outline-variant/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-lowest text-on-surface">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Scenario</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                    <th className="px-4 py-3 font-semibold">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {['cold_kill', 'flood', 'env_corrupt', 'db_drop', 'bad_deploy'].map((key) => (
                    <tr key={key} className="border-t border-outline-variant/10 text-on-surface-variant">
                      <td className="px-4 py-4 font-medium text-on-surface">{key.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-4">
                        <span className={results[key] ? 'text-[#00b34d]' : 'text-error'}>
                          {results[key] ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-4">{verdicts[key] || 'No verdict recorded.'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
