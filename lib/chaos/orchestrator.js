import { createLocusClient } from '@/lib/locus'
import { coldKill } from './cold-kill'
import { flood } from './flood'
import { envCorrupt } from './env-corrupt'
import { dbDrop } from './db-drop'
import { badDeploy } from './bad-deploy'
import { score } from '@/lib/score'
import { prisma } from '@/lib/prisma'

export async function runChaos({ repoUrl, runId, locusApiKey, envVars = {}, emit }) {
  const locus = createLocusClient(locusApiKey, emit)
  const logEvents = []
  const partialResults = {}
  const partialVerdicts = {}
  const runStartedAt = Date.now()
  const FUNCTION_BUDGET_MS = 285000
  const trackedEmit = (event) => {
    if (event.type === 'log' || event.type === 'api_call' || event.type === 'error') {
      logEvents.push({ ...event, timestamp: Date.now() })
      queuePersist()
    }
    emit(event)
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const getRemainingBudgetMs = () => FUNCTION_BUDGET_MS - (Date.now() - runStartedAt)
  let persistTimer = null
  let queuedOverrides = {}
  const persistRun = async (data) => {
    if (!runId) return
    await prisma.run.update({
      where: { id: runId },
      data,
    })
  }
  const buildPersistData = (overrides = {}) => ({
    repoUrl,
    status: 'running',
    projectId: projectId ?? null,
    environmentId: environmentId ?? null,
    serviceId: serviceId ?? null,
    serviceUrl: serviceUrl ?? null,
    dbId: dbId ?? null,
    results: Object.keys(partialResults).length > 0 ? { ...partialResults } : null,
    verdicts: Object.keys(partialVerdicts).length > 0 ? { ...partialVerdicts } : null,
    logEvents: [...logEvents],
    ...queuedOverrides,
    ...overrides,
  })
  const queuePersist = (overrides = {}) => {
    if (!runId) return
    queuedOverrides = { ...queuedOverrides, ...overrides }

    if (persistTimer) {
      return
    }

    persistTimer = setTimeout(async () => {
      const pendingOverrides = queuedOverrides
      queuedOverrides = {}
      persistTimer = null

      try {
        await persistRun(buildPersistData(pendingOverrides))
      } catch {}
    }, 1000)
  }
  const flushPersist = async (overrides = {}) => {
    if (!runId) return

    queuedOverrides = { ...queuedOverrides, ...overrides }

    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }

    const pendingOverrides = queuedOverrides
    queuedOverrides = {}

    try {
      await persistRun(buildPersistData(pendingOverrides))
    } catch {}
  }

  async function waitForLive(deploymentId, url, timeoutSecs) {
    trackedEmit({ type: 'log', message: 'Waiting for Locus deployment to complete (3-7 mins)...' });
    const deadline = Date.now() + timeoutSecs * 1000;
    while (Date.now() < deadline) {
      try {
        const deployData = await locus.getDeployment(deploymentId);
        trackedEmit({ type: 'log', message: `Deployment status: ${deployData.status}...` });
        if (deployData.status === 'healthy') {
          // Wait up to an extra 60 seconds from skills.md for load balancer
          trackedEmit({ type: 'log', message: 'Deployment healthy. Waiting up to 60s for LB to register...' });
          for (let i = 0; i < 12; i++) {
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
              if (res.ok) return;
            } catch {}
            await sleep(5000);
          }
          return; // Continue anyway if it mostly works
        }
        if (['failed', 'error', 'cancelled', 'canceled'].includes(String(deployData.status).toLowerCase())) {
          throw new Error('Deployment failed on Locus platform');
        }
      } catch (err) {
        if (err.message.includes('Deployment failed')) throw err;
      }

      try {
        const res = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          trackedEmit({ type: 'log', message: 'Service is responding even though deployment status is still pending. Continuing to chaos tests...' });
          return;
        }
      } catch {}

      await sleep(5000);
    }
    throw new Error('Deployment did not become healthy within timeout');
  }

  // 1. Deploy target app
  trackedEmit({ type: 'log', message: 'Deploying target app to Locus...' })
  let projectId, environmentId, serviceId, serviceUrl, dbId, deploymentId, serviceEnvVars;
  try {
    const deployment = await locus.deployService(repoUrl, envVars)
    projectId = deployment.projectId
    environmentId = deployment.environmentId
    serviceId = deployment.serviceId
    serviceUrl = deployment.serviceUrl
    dbId = deployment.dbId
    deploymentId = deployment.deploymentId
    serviceEnvVars = deployment.serviceEnvVars
    queuePersist()
  } catch (err) {
    trackedEmit({ type: 'log', message: `Deploy error: ${err.message}` })
    partialVerdicts.error = err.message
    await flushPersist({
      status: 'error',
      completedAt: new Date(),
    })
    trackedEmit({ type: 'done' })
    return;
  }

  // 2. Wait for live
  try {
    await waitForLive(deploymentId, serviceUrl, 600); // 10 minutes timeout
  } catch (err) {
    trackedEmit({ type: 'log', message: `Wait error: ${err.message}` })
    partialVerdicts.error = err.message
    await flushPersist({
      status: 'error',
      completedAt: new Date(),
    })
    trackedEmit({ type: 'done' })
    return;
  }

  // 3. Run scenarios
  const results = {}
  const scenarios = [
    { key: 'flood',       label: 'Traffic Flood',  fn: flood,       estimatedMs: 15000 },
    { key: 'cold_kill',   label: 'Cold Kill',      fn: coldKill,    estimatedMs: 45000 },
    { key: 'env_corrupt', label: 'Env Corruption', fn: envCorrupt,  estimatedMs: 90000 },
    { key: 'db_drop',     label: 'DB Drop',        fn: dbDrop,      estimatedMs: 15000 },
    { key: 'bad_deploy',  label: 'Bad Deploy',     fn: badDeploy,   estimatedMs: 30000 },
  ]

  for (const s of scenarios) {
    trackedEmit({ type: 'scenario_start', scenario: s.key, label: s.label })
    await sleep(500)

    const remainingBudgetMs = getRemainingBudgetMs()

    if (remainingBudgetMs < s.estimatedMs + 10000) {
      const detail = 'Skipped to stay within the deployment function runtime budget'
      results[s.key] = { passed: false, detail }
      partialResults[s.key] = false
      partialVerdicts[s.key] = detail
      trackedEmit({ type: 'log', message: `${s.label} skipped because only ${Math.max(0, Math.floor(remainingBudgetMs / 1000))}s remained in the function budget.` })
      trackedEmit({ type: 'scenario_result', scenario: s.key, passed: false, detail })
      await flushPersist()
      continue
    }

    try {
      const result = await s.fn({ locus, serviceUrl, serviceId, dbId, serviceEnvVars, emit: trackedEmit })
      results[s.key] = result
      partialResults[s.key] = result.passed
      partialVerdicts[s.key] = result.detail
      trackedEmit({ type: 'scenario_result', scenario: s.key, passed: result.passed, detail: result.detail })
    } catch (err) {
      results[s.key] = { passed: false, detail: `Error: ${err.message}` }
      partialResults[s.key] = false
      partialVerdicts[s.key] = `Error: ${err.message}`
      trackedEmit({ type: 'scenario_result', scenario: s.key, passed: false, detail: `Error: ${err.message}` })
    }
    await flushPersist()
  }

  // 4. Score
  const final = score(results)
  await flushPersist({
    grade: final.grade,
    points: final.points,
    status: 'done',
    results: final.breakdown,
    verdicts: final.verdicts,
    completedAt: new Date(),
  })
  trackedEmit({ type: 'score', ...final })
  trackedEmit({ type: 'done' })
}
