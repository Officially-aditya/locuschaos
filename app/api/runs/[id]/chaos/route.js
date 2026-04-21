import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import emitter from '@/lib/emitter'
import { prisma } from '@/lib/prisma'
import { runStoredChaos } from '@/lib/chaos/orchestrator'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(_req, { params }) {
  const session = await getServerSession(authOptions)
  const locusApiKey = process.env.LOCUS_API_KEY

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!locusApiKey) {
    return Response.json({ error: 'LOCUS_API_KEY not configured on server' }, { status: 500 })
  }

  const run = await prisma.run.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    select: {
      id: true,
      serviceId: true,
      serviceUrl: true,
      results: true,
      status: true,
    },
  })

  if (!run) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (!run.serviceId || !run.serviceUrl) {
    return Response.json({ error: 'Run has no live deployment to chaos test' }, { status: 400 })
  }

  if (run.status === 'running' && run.results) {
    return Response.json({ started: true, runId: run.id })
  }

  await prisma.run.update({
    where: { id: run.id },
    data: {
      status: 'running',
      grade: null,
      points: null,
      completedAt: null,
    },
  })

  runStoredChaos({
    runId: run.id,
    locusApiKey,
    emit: (event) => emitter.emit(`event:${run.id}`, event),
  }).catch(async (error) => {
    emitter.emit(`event:${run.id}`, { type: 'error', message: error.message })
    emitter.emit(`event:${run.id}`, { type: 'done' })

    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'error',
        verdicts: { error: error.message },
        completedAt: new Date(),
      },
    })
  })

  return Response.json({ started: true, runId: run.id })
}
