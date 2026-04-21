import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLocusClient } from '@/lib/locus'

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const run = await prisma.run.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  })

  if (!run) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (!run.serviceId) {
    return Response.json({ error: 'Run has no service to tear down' }, { status: 400 })
  }

  const locusApiKey = process.env.LOCUS_API_KEY

  if (!locusApiKey) {
    return Response.json({ error: 'LOCUS_API_KEY not configured on server' }, { status: 500 })
  }

  const locus = createLocusClient(locusApiKey, () => {})
  await locus.deleteService(run.serviceId)

  await prisma.run.update({
    where: { id: run.id },
    data: {
      status: 'torn_down',
    },
  })

  return Response.json({ success: true })
}
