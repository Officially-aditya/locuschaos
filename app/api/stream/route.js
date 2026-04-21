import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import emitter from '@/lib/emitter'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('runId')

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!runId) {
    return new Response('Missing runId', { status: 400 })
  }

  const run = await prisma.run.findFirst({
    where: {
      id: runId,
      userId: session.user.id,
    },
    select: { id: true },
  })

  if (!run) {
    return new Response('Not found', { status: 404 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (data) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      emitter.on(`event:${runId}`, send)
      
      req.signal.addEventListener('abort', () => {
          emitter.off(`event:${runId}`, send)
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  })
}
