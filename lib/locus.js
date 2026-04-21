export function createLocusClient(apiKey, emit) {
  const base = 'https://beta-api.buildwithlocus.com/v1';
  const databaseUrlBinding = '${{main-db.DATABASE_URL}}';

  let cachedToken = null;

  async function getToken() {
    if (cachedToken) return cachedToken;
    emit({ type: 'api_call', method: 'POST', endpoint: '/auth/exchange' });
    const res = await fetch(`${base}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Locus Auth failed: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    cachedToken = data.token;
    return cachedToken;
  }

  async function call(method, path, body) {
    emit({ type: 'api_call', method, endpoint: path });
    const token = await getToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      if (res.status === 204) return null; // No Content
      const errorText = await res.text().catch(() => '');
      throw new Error(`Locus API ${method} ${path} → ${res.status} ${errorText}`);
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return res.json();
    }
    return null;
  }

  // Parse `https://github.com/my-org/my-repo` -> `my-org/my-repo`
  function getRepoPath(url) {
    try {
      const parsed = new URL(url);
      return parsed.pathname.replace(/^\/+/, '').replace(/\.git$/, '');
    } catch {
      return url; // fallback
    }
  }

  return {
    deployService: async (repoUrl, envVars) => {
      const repoPath = getRepoPath(repoUrl);
      
      // 1. Create project & service from repo
      const fromRepoRes = await call('POST', '/projects/from-repo', { name: repoPath.split('/').pop().toLowerCase(), repo: repoPath, branch: 'main' });
      const projectId = fromRepoRes.project.id;
      const environmentId = fromRepoRes.environment.id;
      const serviceId = fromRepoRes.services[0].id;
      const serviceUrl = fromRepoRes.services[0].url;

      // 2. Create the DB addon
      const dbRes = await call('POST', '/addons', {
        projectId,
        environmentId,
        type: 'postgres',
        name: 'main-db'
      });
      const dbId = dbRes.id;

      // 3. Poll DB until available (takes ~30-60s)
      emit({ type: 'log', message: 'Waiting for database to provision...' });
      while (true) {
        const dbStatusRes = await call('GET', `/addons/${dbId}`);
        if (dbStatusRes.status === 'available') break;
        if (dbStatusRes.status === 'failed') throw new Error('Database provisioning failed');
        await new Promise(r => setTimeout(r, 5000));
      }

      // 4. Update service env vars with DB URL
      const mergedVars = { ...envVars, DATABASE_URL: databaseUrlBinding };
      await call('PUT', `/variables/service/${serviceId}`, { variables: mergedVars });

      // 5. Trigger new deployment so it picks up the DB URL
      const deployRes = await call('POST', '/deployments', { serviceId });

      return {
        projectId,
        environmentId,
        serviceId,
        serviceUrl,
        dbId,
        deploymentId: deployRes.id,
        serviceEnvVars: mergedVars,
      };
    },
    getService: (serviceId) => call('GET', `/services/${serviceId}`),
    getDeployment: (deploymentId) => call('GET', `/deployments/${deploymentId}`),
    restartService: (serviceId) => call('POST', `/services/${serviceId}/restart`),
    deleteService: (serviceId) => call('DELETE', `/services/${serviceId}`),
    deleteProject: (projectId) => call('DELETE', `/projects/${projectId}`),
    deleteEnvironment: (projectId, environmentId) => call('DELETE', `/projects/${projectId}/environments/${environmentId}`),
    updateEnvVars: (serviceId, vars) => call('PATCH', `/variables/service/${serviceId}`, { variables: vars }),
    redeployService: (serviceId) => call('POST', `/services/${serviceId}/redeploy`),
    deployDatabase: async (projectId, envId) => call('POST', '/addons', { projectId, environmentId: envId, type: 'postgres', name: 'main-db' }),
    // TODO: Need Locus API for restartDatabase (not found in SKILL doc)
    restartDatabase: async (dbId) => { throw new Error("TODO: Locus API for restarting an addon is missing from docs."); },
  }
}
