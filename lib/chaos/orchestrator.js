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

  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const persistRun = async (data) => {
    if (!runId) return
    await prisma.run.update({
      where: { id: runId },
      data,
    })
  }

  async function waitForLive(deploymentId, url, timeoutSecs) {
    emit({ type: 'log', message: 'Waiting for Locus deployment to complete (3-7 mins)...' });
    const deadline = Date.now() + timeoutSecs * 1000;
    while (Date.now() < deadline) {
      try {
        const deployData = await locus.getDeployment(deploymentId);
        emit({ type: 'log', message: `Deployment status: ${deployData.status}...` });
        if (deployData.status === 'healthy') {
          // Wait up to an extra 60 seconds from skills.md for load balancer
          emit({ type: 'log', message: 'Deployment healthy. Waiting up to 60s for LB to register...' });
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
  emit({ type: 'log', message: 'Deploying target app to Locus...' })
  let serviceId, serviceUrl, dbId, deploymentId, serviceEnvVars;
  try {
    const deployment = await locus.deployService(repoUrl, envVars)
    serviceId = deployment.serviceId
    serviceUrl = deployment.serviceUrl
    dbId = deployment.dbId
    deploymentId = deployment.deploymentId
    serviceEnvVars = deployment.serviceEnvVars
  } catch (err) {
    emit({ type: 'log', message: `Deploy error: ${err.message}` })
    await persistRun({
      status: 'error',
      repoUrl,
      serviceId: serviceId ?? null,
      serviceUrl: serviceUrl ?? null,
      verdicts: { error: err.message },
      completedAt: new Date(),
    })
    emit({ type: 'done' })
    return;
  }

  // 2. Wait for live
  try {
    await waitForLive(deploymentId, serviceUrl, 600); // 10 minutes timeout
  } catch (err) {
    emit({ type: 'log', message: `Wait error: ${err.message}` })
    await persistRun({
      status: 'error',
      repoUrl,
      serviceId: serviceId ?? null,
      serviceUrl: serviceUrl ?? null,
      verdicts: { error: err.message },
      completedAt: new Date(),
    })
    emit({ type: 'done' })
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
    emit({ type: 'scenario_start', scenario: s.key, label: s.label })
    await sleep(2000) // brief pause so UI renders the start
    try {
      const result = await s.fn({ locus, serviceUrl, serviceId, dbId, serviceEnvVars, emit })
      results[s.key] = result
      emit({ type: 'scenario_result', scenario: s.key, passed: result.passed, detail: result.detail })
    } catch (err) {
      results[s.key] = { passed: false, detail: `Error: ${err.message}` }
      emit({ type: 'scenario_result', scenario: s.key, passed: false, detail: `Error: ${err.message}` })
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
    serviceId,
    serviceUrl,
    completedAt: new Date(),
  })
  emit({ type: 'score', ...final })
  emit({ type: 'done' })
}
