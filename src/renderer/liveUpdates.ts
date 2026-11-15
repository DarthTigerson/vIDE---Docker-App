import { useEffect } from 'react'
import { useDockerStore } from './dockerStore'
import { getVide } from './vide'

const POLL_INTERVAL_MS = 5000
// `docker events` emits one line per container per lifecycle stage (create,
// attach, start, health_status, ...), so bringing up a compose stack fires a
// burst of these in a few seconds, and health checks keep emitting
// health_status events for as long as the stack runs. Debounce so a burst
// coalesces into a single refresh instead of spawning a `docker` CLI call
// per line, which was flooding the daemon enough to cause status flicker.
const CHANGE_DEBOUNCE_MS = 300

// Keeps Docker status/container state fresh. watch/unwatch is ref-counted in
// the store, so this composes with the panel and logs tabs running it too.
export function startLiveUpdates(): () => void {
  const { refresh, startWatching, stopWatching } = useDockerStore.getState()
  refresh()
  startWatching()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const offChanged = getVide().app.on('changed', () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      refresh()
    }, CHANGE_DEBOUNCE_MS)
  })
  const interval = setInterval(() => {
    if (document.visibilityState !== 'visible') return
    refresh()
  }, POLL_INTERVAL_MS)
  return () => {
    offChanged()
    if (debounceTimer) clearTimeout(debounceTimer)
    clearInterval(interval)
    stopWatching()
  }
}

export function useDockerLiveUpdates(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    return startLiveUpdates()
  }, [enabled])
}
