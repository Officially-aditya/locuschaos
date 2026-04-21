import { runChaos } from './lib/chaos/orchestrator.js';

const locusApiKey = process.env.LOCUS_API_KEY;

if (!locusApiKey) {
  throw new Error('LOCUS_API_KEY must be set');
}

runChaos({
  repoUrl: 'https://github.com/test/repo',
  locusApiKey,
  emit: (data) => console.log(data)
})
  .then(() => console.log('Finished'))
  .catch(console.error);
