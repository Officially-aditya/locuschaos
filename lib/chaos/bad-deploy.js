import { sleep } from './utils'

export async function badDeploy({ locus, serviceUrl, serviceId, emit }) {
  // 1. Trigger a deploy from a repo with a bad start command
  const badDeploy = locus.deployService('https://github.com/YOUR_ORG/locuschoas-bad-fixture', {})

  // 2. While deploy is in progress, poll the original service URL
  const checks = []
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(serviceUrl, { signal: AbortSignal.timeout(3000) })
      checks.push(res.ok)
    } catch {
      checks.push(false)
    }
  }, 3000)

  await badDeploy.catch(() => {}) // bad deploy will fail — that's expected
  clearInterval(pollInterval)

  await sleep(5000)

  const wasAlive = checks.length > 0 && checks.every(Boolean)

  return {
    passed: wasAlive,
    detail: wasAlive
      ? 'Previous version stayed live throughout bad deploy'
      : 'Service went down during bad deploy — no rollback protection'
  }
}