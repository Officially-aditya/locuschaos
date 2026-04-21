import { sleep, waitUntilUp } from './utils'

export async function envCorrupt({ locus, serviceUrl, serviceId, serviceEnvVars }) {
  const originalDatabaseUrl = serviceEnvVars?.DATABASE_URL

  if (!originalDatabaseUrl) {
    throw new Error('Missing original DATABASE_URL for env restore')
  }

  // 1. Corrupt a required env var
  await locus.updateEnvVars(serviceId, { DATABASE_URL: '__CORRUPTED__' })
  await locus.redeployService(serviceId)
  await sleep(20000) // wait for redeploy

  // 2. Hit the app — should return 4xx/5xx, not hang or 200
  let passed = false
  let detail = ''
  try {
    const res = await fetch(serviceUrl, { signal: AbortSignal.timeout(10000) })
    if (res.status >= 400) {
      passed = true
      detail = `Returned ${res.status} on bad config — fails loudly, not silently`
    } else {
      passed = false
      detail = `Returned ${res.status} with corrupted env — silent failure`
    }
  } catch (err) {
    passed = false
    detail = `Timed out with corrupted env — silent hang`
  }

  // 3. Restore
  await locus.updateEnvVars(serviceId, { DATABASE_URL: originalDatabaseUrl })
  await locus.redeployService(serviceId)
  await waitUntilUp(serviceUrl, 60)

  return { passed, detail }
}
