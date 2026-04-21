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
  const trackedEmit = (event) => {
    if (event.type === 'log' || event.type === 'api_call' || event.type === 'error') {
      logEvents.push({ ...event, timestamp: Date.now() })
    }
    emit(event)
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const persistRun = async (data) => {
    if (!runId) return
    await prisma.run.update({
      where: { id: runId },
      data,
    })
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
        if (deployData.status === 'failed') {
          throw new Error('Deployment failed on Locus platform');
        }
      } catch (err) {
        if (err.message.includes('Deployment failed')) throw err;
      }
      await sleep(10000); // Polling every 10 seconds is safe for backend (skills.md says 60s for humans, but 10s for bot UI is fine)
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
  } catch (err) {
    trackedEmit({ type: 'log', message: `Deploy error: ${err.message}` })
    await persistRun({
      status: 'error',
      repoUrl,
      projectId: projectId ?? null,
      environmentId: environmentId ?? null,
      serviceId: serviceId ?? null,
      serviceUrl: serviceUrl ?? null,
      dbId: dbId ?? null,
      verdicts: { error: err.message },
      logEvents,
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
    await persistRun({
      status: 'error',
      repoUrl,
      projectId: projectId ?? null,
      environmentId: environmentId ?? null,
      serviceId: serviceId ?? null,
      serviceUrl: serviceUrl ?? null,
      dbId: dbId ?? null,
      verdicts: { error: err.message },
      logEvents,
      completedAt: new Date(),
    })
    trackedEmit({ type: 'done' })
    return;
  }

  // 3. Run scenarios
  const results = {}
  const scenarios = [
    { key: 'cold_kill',   label: 'Cold Kill',       fn: coldKill },
    { key: 'flood',       label: 'Traffic Flood',    fn: flood },
    { key: 'env_corrupt', label: 'Env Corruption',   fn: envCorrupt },
    { key: 'db_drop',     label: 'DB Drop',          fn: dbDrop },
    { key: 'bad_deploy',  label: 'Bad Deploy',       fn: badDeploy },
  ]

  for (const s of scenarios) {
    trackedEmit({ type: 'scenario_start', scenario: s.key, label: s.label })
    await sleep(2000) // brief pause so UI renders the start
    try {
      const result = await s.fn({ locus, serviceUrl, serviceId, dbId, serviceEnvVars, emit: trackedEmit })
      results[s.key] = result
      trackedEmit({ type: 'scenario_result', scenario: s.key, passed: result.passed, detail: result.detail })
    } catch (err) {
      results[s.key] = { passed: false, detail: `Error: ${err.message}` }
      trackedEmit({ type: 'scenario_result', scenario: s.key, passed: false, detail: `Error: ${err.message}` })
    }
    await sleep(30000) // 30s buffer between scenarios
  }

  // 4. Score
  const final = score(results)
  await persistRun({
    grade: final.grade,
    points: final.points,
    status: 'done',
    results: final.breakdown,
    verdicts: final.verdicts,
    logEvents,
    projectId,
    environmentId,
    serviceId,
    serviceUrl,
    dbId,
    completedAt: new Date(),
  })
  trackedEmit({ type: 'score', ...final })
  trackedEmit({ type: 'done' })
}
