import autocannon from 'autocannon'
import { promisify } from 'util'
const run = promisify(autocannon)

export async function flood({ serviceUrl, emit }) {
  const result = await run({
    url: serviceUrl,
    connections: 50,
    amount: 500,
    timeout: 30
  })

  const errorRate = result.errors / result.requests.total
  const p99 = result.latency.p99

  emit({ type: 'metric', scenario: 'flood', key: 'error_rate', value: errorRate })
  emit({ type: 'metric', scenario: 'flood', key: 'latency_p99_ms', value: p99 })

  return {
    passed: errorRate < 0.05,
    detail: errorRate < 0.05
      ? `Handled 500 requests with ${(errorRate * 100).toFixed(1)}% error rate, p99 ${p99}ms`
      : `${(errorRate * 100).toFixed(1)}% error rate under load — exceeds 5% threshold`
  }
}
