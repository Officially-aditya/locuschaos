import { createLocusClient } from '@/lib/locus'
import { coldKill } from './cold-kill'
import { flood } from './flood'
import { envCorrupt } from './env-corrupt'
import { dbDrop } from './db-drop'
import { badDeploy } from './bad-deploy'
import { score } from '@/lib/score'
import { prisma } from '@/lib/prisma'

const FUNCTION_BUDGET_MS = 285000
const DATABASE_URL_BINDING = '${{main-db.DATABASE_URL}}'
const SCENARIOS = [
  { key: 'flood', label: 'Traffic Flood', fn: flood, estimatedMs: 15000 },
  { key: 'cold_kill', label: 'Cold Kill', fn: coldKill, estimatedMs: 45000 },
  { key: 'env_corrupt', label: 'Env Corruption', fn: envCorrupt, estimatedMs: 90000 },
  { key: 'db_drop', label: 'DB Drop', fn: dbDrop, estimatedMs: 15000 },
  { key: 'bad_deploy', label: 'Bad Deploy', fn: badDeploy, estimatedMs: 30000 },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createRunPersistence({ runId, repoUrl, emit, locusApiKey, initialRun = {} }) {
  const locus = createLocusClient(locusApiKey, emit)
  const logEvents = Array.isArray(initialRun.logEvents) ? [...initialRun.logEvents] : []
  const partialResults = initialRun.results && typeof initialRun.results === 'object' ? { ...initialRun.results } : {}
  const partialVerdicts = initialRun.verdicts && typeof initialRun.verdicts === 'object' ? { ...initialRun.verdicts } : {}
  const runStartedAt = Date.now()

  let projectId = initialRun.projectId ?? null
  let environmentId = initialRun.environmentId ?? null
  let serviceId = initialRun.serviceId ?? null
  let serviceUrl = initialRun.serviceUrl ?? null
  let dbId = initialRun.dbId ?? null
  let deploymentId = initialRun.deploymentId ?? null
  let serviceEnvVars = initialRun.serviceEnvVars ?? null
  let persistTimer = null
  let queuedOverrides = {}

  const persistRun = async (data) => {
    if (!runId) return

    await prisma.run.update({
      where: { id: runId },
      data,
    })
  }

  const trackedEmit = (event) => {
    if (event.type === 'log' || event.type === 'api_call' || event.type === 'error') {
      logEvents.push({ ...event, timestamp: Date.now() })
      queuePersist()
    }

    emit(event)
  }

  const buildPersistData = (overrides = {}) => ({
    repoUrl,
    projectId,
    environmentId,
    serviceId,
    serviceUrl,
    dbId,
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

  return {
    locus,
    trackedEmit,
    flushPersist,
    queuePersist,
    getRemainingBudgetMs: () => FUNCTION_BUDGET_MS - (Date.now() - runStartedAt),
    getRunResources: () => ({
      projectId,
      environmentId,
      serviceId,
      serviceUrl,
      dbId,
      deploymentId,
      serviceEnvVars,
    }),
    setRunResources: (resources) => {
      projectId = resources.projectId ?? projectId
      environmentId = resources.environmentId ?? environmentId
      serviceId = resources.serviceId ?? serviceId
      serviceUrl = resources.serviceUrl ?? serviceUrl
      dbId = resources.dbId ?? dbId
      deploymentId = resources.deploymentId ?? deploymentId
      serviceEnvVars = resources.serviceEnvVars ?? serviceEnvVars
    },
    partialResults,
    partialVerdicts,
  }
}

async function waitForLive(locus, trackedEmit, deploymentId, url, timeoutSecs) {
  trackedEmit({ type: 'log', message: 'Waiting for Locus deployment to complete (3-7 mins)...' })
  const deadline = Date.now() + timeoutSecs * 1000

  while (Date.now() < deadline) {
    try {
      const deployData = await locus.getDeployment(deploymentId)
      trackedEmit({ type: 'log', message: `Deployment status: ${deployData.status}...` })

      if (deployData.status === 'healthy') {
        trackedEmit({ type: 'log', message: 'Deployment healthy. Waiting up to 60s for LB to register...' })

        for (let i = 0; i < 12; i += 1) {
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
            if (res.ok) return
          } catch {}

          await sleep(5000)
        }

        return
      }

      if (['failed', 'error', 'cancelled', 'canceled'].includes(String(deployData.status).toLowerCase())) {
        throw new Error('Deployment failed on Locus platform')
      }
    } catch (error) {
      if (error.message.includes('Deployment failed')) throw error
    }

    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      })

      if (res.ok) {
        trackedEmit({ type: 'log', message: 'Service is responding even though deployment status is still pending. Marking deploy as ready...' })
        return
      }
    } catch {}

    await sleep(5000)
  }

  throw new Error('Deployment did not become healthy within timeout')
}

export async function runChaos({ repoUrl, runId, locusApiKey, envVars = {}, emit }) {
  const ctx = createRunPersistence({ runId, repoUrl, emit, locusApiKey })
  const { locus, trackedEmit, flushPersist, queuePersist, partialVerdicts, setRunResources, getRunResources } = ctx

  trackedEmit({ type: 'log', message: 'Deploying target app to Locus...' })

  try {
    const deployment = await locus.deployService(repoUrl, envVars)

    setRunResources({
      projectId: deployment.projectId,
      environmentId: deployment.environmentId,
      serviceId: deployment.serviceId,
      serviceUrl: deployment.serviceUrl,
      dbId: deployment.dbId,
      deploymentId: deployment.deploymentId,
      serviceEnvVars: deployment.serviceEnvVars,
    })

    queuePersist({ status: 'deploying' })
  } catch (error) {
    trackedEmit({ type: 'log', message: `Deploy error: ${error.message}` })
    partialVerdicts.error = error.message
    await flushPersist({
      status: 'error',
      completedAt: new Date(),
    })
    trackedEmit({ type: 'done' })
    return
  }

  try {
    const { deploymentId, serviceUrl } = getRunResources()
    await waitForLive(locus, trackedEmit, deploymentId, serviceUrl, 600)
  } catch (error) {
    trackedEmit({ type: 'log', message: `Wait error: ${error.message}` })
    partialVerdicts.error = error.message
    await flushPersist({
      status: 'error',
      completedAt: new Date(),
    })
    trackedEmit({ type: 'done' })
    return
  }

  trackedEmit({ type: 'log', message: 'Deployment is live. Chaos tests will start in a fresh worker...' })
  await flushPersist({ status: 'ready' })
  emit({ type: 'deployment_ready', runId })
}

export async function runStoredChaos({ runId, locusApiKey, emit }) {
  const existingRun = await prisma.run.findUnique({
    where: { id: runId },
  })

  if (!existingRun) {
    throw new Error('Run not found')
  }

  if (!existingRun.serviceId || !existingRun.serviceUrl) {
    throw new Error('Run has no live deployment to chaos test')
  }

  const ctx = createRunPersistence({
    runId,
    repoUrl: existingRun.repoUrl,
    emit,
    locusApiKey,
    initialRun: existingRun,
  })
  const { locus, trackedEmit, flushPersist, getRemainingBudgetMs, partialResults, partialVerdicts } = ctx
  const serviceEnvVars = { DATABASE_URL: DATABASE_URL_BINDING }

  trackedEmit({ type: 'log', message: 'Starting chaos suite against the live deployment...' })
  await flushPersist({ status: 'running', completedAt: null })

  const results = {}

  for (const scenario of SCENARIOS) {
    trackedEmit({ type: 'log', message: `Starting ${scenario.label}...` })
    emit({ type: 'scenario_start', scenario: scenario.key, label: scenario.label })
    await sleep(500)

    const remainingBudgetMs = getRemainingBudgetMs()

    if (remainingBudgetMs < scenario.estimatedMs + 10000) {
      const detail = 'Skipped to stay within the chaos worker runtime budget'
      results[scenario.key] = { passed: false, detail }
      partialResults[scenario.key] = false
      partialVerdicts[scenario.key] = detail
      trackedEmit({ type: 'log', message: `${scenario.label} skipped because only ${Math.max(0, Math.floor(remainingBudgetMs / 1000))}s remained in the chaos worker budget.` })
      emit({ type: 'scenario_result', scenario: scenario.key, passed: false, detail })
      await flushPersist({ status: 'running' })
      continue
    }

    try {
      const result = await scenario.fn({
        locus,
        serviceUrl: existingRun.serviceUrl,
        serviceId: existingRun.serviceId,
        dbId: existingRun.dbId,
        serviceEnvVars,
        emit: trackedEmit,
      })

      results[scenario.key] = result
      partialResults[scenario.key] = result.passed
      partialVerdicts[scenario.key] = result.detail
      emit({ type: 'scenario_result', scenario: scenario.key, passed: result.passed, detail: result.detail })
    } catch (error) {
      const detail = `Error: ${error.message}`
      results[scenario.key] = { passed: false, detail }
      partialResults[scenario.key] = false
      partialVerdicts[scenario.key] = detail
      emit({ type: 'scenario_result', scenario: scenario.key, passed: false, detail })
    }

    await flushPersist({ status: 'running' })
  }

  const final = score(results)

  await flushPersist({
    grade: final.grade,
    points: final.points,
    status: 'done',
    results: final.breakdown,
    verdicts: final.verdicts,
    completedAt: new Date(),
  })

  emit({ type: 'score', ...final })
  emit({ type: 'done' })
}
