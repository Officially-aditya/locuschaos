import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
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

  return Response.json(run)
}
