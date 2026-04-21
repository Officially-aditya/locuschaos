import { Suspense } from 'react'
import LocusChaosApp from '@/components/LocusChaosApp'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LocusChaosApp />
    </Suspense>
  )
}
