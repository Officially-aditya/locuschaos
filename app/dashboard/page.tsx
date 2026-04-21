import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import RunCard from '@/components/RunCard'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!userId) {
    redirect('/login')
  }

  const runs = await prisma.run.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <>
      <Sidebar activePath="/dashboard" />

      <main className="ml-0 md:ml-64 flex-1 h-full overflow-y-auto bg-surface p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-headline text-3xl font-black tracking-tight text-on-surface">Run History</h1>
              <p className="font-body text-sm text-on-surface-variant mt-2">Every deployment, grade, and teardown state tied to your account.</p>
            </div>
            <a href="/" className="inline-flex items-center justify-center rounded-lg bg-primary-container px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary transition-colors">
              + New Run
            </a>
          </div>

          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low p-16 text-center text-on-surface-variant">
              No runs yet. Deploy something and break it.
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => <RunCard key={run.id} run={run} />)}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
