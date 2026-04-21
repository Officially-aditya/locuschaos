export function score(results) {
  const keys = ['cold_kill', 'flood', 'env_corrupt', 'db_drop', 'bad_deploy']
  const passed = keys.filter(k => results[k]?.passed).length
  const total = keys.length * 20
  const points = passed * 20

  const grade =
    points >= 90 ? 'A' :
    points >= 70 ? 'B' :
    points >= 50 ? 'C' :
    points >= 30 ? 'D' : 'F'

  const verdicts = {
    cold_kill:   results.cold_kill?.detail   ?? 'Not run',
    flood:       results.flood?.detail       ?? 'Not run',
    env_corrupt: results.env_corrupt?.detail ?? 'Not run',
    db_drop:     results.db_drop?.detail     ?? 'Not run',
    bad_deploy:  results.bad_deploy?.detail  ?? 'Not run',
  }

  return { grade, points, total, breakdown: Object.fromEntries(keys.map(k => [k, results[k]?.passed ?? false])), verdicts }
}