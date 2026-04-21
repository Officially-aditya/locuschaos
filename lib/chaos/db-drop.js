import { sleep } from './utils'

export async function dbDrop({ locus, serviceUrl, dbId, emit }) {
  // 1. Stop the DB
  // TODO: locus API documentation for restartDatabase is missing, skipping scenario
  await locus.restartDatabase(dbId)

  // 2. Immediately hit DB-dependent endpoint
  const start = Date.now()

  // 3. Poll until DB queries work again
  let recovery_ms = null
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(5000) })
      const body = await res.json()
      if (body.db === 'connected') {
        recovery_ms = Date.now() - start
        break
      }
    } catch {}
    await sleep(3000)
  }

  emit({ type: 'metric', scenario: 'db_drop', key: 'db_recovery_ms', value: recovery_ms })

  return {
    passed: recovery_ms !== null && recovery_ms < 60000,
    detail: recovery_ms === null
      ? 'DB never reconnected within 90s'
      : recovery_ms < 60000
        ? `DB reconnected in ${(recovery_ms / 1000).toFixed(1)}s`
        : `DB took ${(recovery_ms / 1000).toFixed(1)}s to reconnect — exceeds 60s threshold`
  }
}