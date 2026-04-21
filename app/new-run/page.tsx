import { Suspense } from 'react'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import LocusChaosApp from '@/components/LocusChaosApp'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function NewRunPage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!userId) {
    redirect('/login')
  }

  return (
    <Suspense fallback={null}>
      <LocusChaosApp activePath="/new-run" />
    </Suspense>
  )
}
