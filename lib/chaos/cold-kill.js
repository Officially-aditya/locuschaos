import { waitUntilDown, waitUntilUp, sleep } from './utils';

export async function coldKill({ locus, serviceUrl, serviceId, emit }) {
  // 1. Kill the service via Locus API
  await locus.restartService(serviceId)

  // 2. Poll until unreachable
  await waitUntilDown(serviceUrl, 15)

  // 3. Start timer, poll until back
  const start = Date.now()
  await waitUntilUp(serviceUrl, 60)
  const recovery_ms = Date.now() - start

  emit({ type: 'metric', scenario: 'cold_kill', key: 'recovery_ms', value: recovery_ms })

  return {
    passed: recovery_ms < 30000,
    detail: recovery_ms < 30000
      ? `Recovered in ${(recovery_ms / 1000).toFixed(1)}s`
      : `Took ${(recovery_ms / 1000).toFixed(1)}s to recover — exceeds 30s threshold`
  }
}
