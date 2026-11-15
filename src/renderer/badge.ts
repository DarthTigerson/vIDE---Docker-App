import type { DockerContainer } from './types'
import type { DockerBadgeMode } from './settingsStore'

// Same rules the activity bar used for the built-in Docker: running count (or
// distinct running Compose projects), capped at "99+", hidden at zero or off.
export function dockerBadge(
  containers: DockerContainer[],
  showBadge: boolean,
  mode: DockerBadgeMode,
): number | string | undefined {
  if (!showBadge) return undefined
  const count =
    mode === 'projects'
      ? new Set(containers.filter((c) => c.state === 'running' && c.project).map((c) => c.project)).size
      : containers.filter((c) => c.state === 'running').length
  return count > 99 ? '99+' : count || undefined
}
