import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import emitter from '@/lib/emitter'
import { runChaos } from '@/lib/chaos/orchestrator'

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const locusApiKey = process.env.LOCUS_API_KEY
  const { repoUrl, envVars = {} } = await req.json()

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!repoUrl) {
    return Response.json({ error: 'Missing repoUrl' }, { status: 400 })
  }

  if (typeof envVars !== 'object' || envVars === null || Array.isArray(envVars)) {
    return Response.json({ error: 'envVars must be a plain object' }, { status: 400 })
  }

  if (!locusApiKey) {
    return Response.json({ error: 'LOCUS_API_KEY not configured on server' }, { status: 500 })
  }

  const run = await prisma.run.create({
    data: {
      userId: session.user.id,
      repoUrl,
      status: 'running',
    },
  })

  runChaos({
    repoUrl,
    runId: run.id,
    locusApiKey,
    envVars,
    emit: (event) => emitter.emit(`event:${run.id}`, event),
  }).catch(async (err) => {
    emitter.emit(`event:${run.id}`, { type: 'error', message: err.message })
    emitter.emit(`event:${run.id}`, { type: 'done' })

    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'error',
        verdicts: { error: err.message },
        completedAt: new Date(),
      },
    })
  })

  return Response.json({ started: true, runId: run.id })
}
