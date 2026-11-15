import { DockerPanel } from './DockerPanel'
import { DockerLogsPage } from './DockerLogsPage'
import { DockerSettingsPage } from './SettingsPage'
import { DockerIcon } from './icons'
import { useDockerStore } from './dockerStore'
import { initDockerSettings, useDockerSettingsStore } from './settingsStore'
import { startLiveUpdates } from './liveUpdates'
import { dockerBadge } from './badge'
import { setVide } from './vide'
import type { Disposable, Json, VideRendererApi } from '../vide'

let teardown: Array<() => void> = []

export function activate(vide: VideRendererApi): void {
  setVide(vide)
  teardown.push(initDockerSettings())

  const panel = vide.ui.registerSidebarPanel({
    title: 'Docker',
    icon: DockerIcon,
    component: DockerPanel,
    requiresProject: true,
  })
  teardown.push(() => panel.dispose())

  teardown.push(vide.ui.registerSettingsPage({ title: 'Docker', component: DockerSettingsPage }).dispose)

  teardown.push(
    vide.ui.registerTabKind('logs', {
      title: (params: Json) => String((params as { containerName?: string } | null)?.containerName ?? 'Logs'),
      component: ({ params }) => {
        const p = (params ?? {}) as { containerId?: string; containerName?: string }
        return <DockerLogsPage containerId={p.containerId ?? ''} containerName={p.containerName ?? ''} />
      },
    }).dispose,
  )

  // Live updates run whenever a project is open, panel mounted or not, so the
  // badge and the Docker-off notification stay accurate.
  let stopLive: (() => void) | null = null
  const syncLive = (root: string | null) => {
    if (root && !stopLive) stopLive = startLiveUpdates()
    else if (!root && stopLive) { stopLive(); stopLive = null }
  }
  syncLive(vide.project.root())
  teardown.push(vide.project.subscribe(syncLive))
  teardown.push(() => { stopLive?.(); stopLive = null })

  // Badge: same running-count / badgeMode rules the activity bar used.
  const updateBadge = () =>
    panel.setBadge(dockerBadge(
      useDockerStore.getState().containers,
      useDockerSettingsStore.getState().showBadge,
      useDockerSettingsStore.getState().badgeMode,
    ))
  updateBadge()
  teardown.push(useDockerStore.subscribe(updateBadge))
  teardown.push(useDockerSettingsStore.subscribe(updateBadge))

  // "Docker isn't running" notification while the daemon is confirmed stopped.
  let alert: Disposable | null = null
  const updateAlert = () => {
    const stopped = useDockerStore.getState().status === 'stopped'
    if (stopped && !alert) {
      alert = vide.notifications.push({
        id: 'docker',
        text: "Docker isn't running",
        onClick: () => vide.ui.openPanel(),
      })
    } else if (!stopped && alert) {
      alert.dispose()
      alert = null
    }
  }
  updateAlert()
  teardown.push(useDockerStore.subscribe(updateAlert))
  teardown.push(() => { alert?.dispose(); alert = null })
}

export function deactivate(): void {
  for (const off of teardown.reverse()) {
    try { off() } catch { /* best effort */ }
  }
  teardown = []
  setVide(null)
}
