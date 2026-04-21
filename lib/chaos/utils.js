export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export async function waitUntilDown(url, timeoutSecs) {
  const deadline = Date.now() + timeoutSecs * 1000
  while (Date.now() < deadline) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
        if (!res.ok) return
    } catch {
        return
    }
    await sleep(2000)
  }
}

export async function waitUntilUp(url, timeoutSecs) {
  const deadline = Date.now() + timeoutSecs * 1000
  while (Date.now() < deadline) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
        if (res.ok) return
    } catch {}
    await sleep(2000)
  }
}