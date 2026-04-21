import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const limitParam = Number(searchParams.get('limit') ?? 50)
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 50

  const runs = await prisma.run.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
  })

  return Response.json(runs)
}
