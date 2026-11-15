// Port of vIDE's electron/docker.ts onto `vide.process.exec`. exec resolves
// the user's login-shell PATH itself, so there is no resolveBinaryPath here.
import type { MainVideApi } from '../vide'

export type Exec = MainVideApi['process']['exec']

export type DockerStatus = 'not-installed' | 'stopped' | 'running' | 'unknown'

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: string
  // Set from the `com.docker.compose.project` label Compose stamps on every
  // container in a stack. Undefined for containers started outside Compose.
  project?: string
}

export interface DockerActionResult {
  ok: boolean
  error?: string
}

export interface DockerContainerStats {
  usedBytes: number
  limitBytes: number
  percent: number
}

const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project'

// `docker ps`'s Labels field is a flat "key=value,key=value" string, not JSON.
export function parseComposeProject(labels: string | undefined): string | undefined {
  if (!labels) return undefined
  for (const pair of labels.split(',')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    if (pair.slice(0, eq) === COMPOSE_PROJECT_LABEL) return pair.slice(eq + 1)
  }
  return undefined
}

export function parseContainers(stdout: string): DockerContainer[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const raw = JSON.parse(line) as Record<string, string>
      return {
        id: raw.ID,
        name: raw.Names,
        image: raw.Image,
        status: raw.Status,
        state: raw.State,
        ports: raw.Ports,
        project: parseComposeProject(raw.Labels),
      }
    })
}

// `docker stats`'s human-readable MemUsage uses binary (Ki/Mi/Gi) units
// even though it prints them without the "i" (e.g. "12.5MiB"). Anything
// unrecognized falls back to treating the number as raw bytes.
const MEM_UNIT_MULTIPLIERS: Record<string, number> = {
  B: 1,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
}

export function parseMemValue(raw: string): number {
  const match = raw.trim().match(/^([\d.]+)\s*([A-Za-z]+)$/)
  if (!match) return 0
  const [, amount, unit] = match
  return parseFloat(amount) * (MEM_UNIT_MULTIPLIERS[unit] ?? 1)
}

export function parseStats(stdout: string): Record<string, DockerContainerStats> {
  const result: Record<string, DockerContainerStats> = {}
  for (const line of stdout.split('\n').filter(Boolean)) {
    const raw = JSON.parse(line) as Record<string, string>
    const [usedRaw, limitRaw] = (raw.MemUsage ?? '').split('/')
    const usedBytes = parseMemValue(usedRaw ?? '0B')
    const limitBytes = parseMemValue(limitRaw ?? '0B')
    const percent = parseFloat((raw.MemPerc ?? '').replace('%', '')) || 0
    result[raw.ID] = { usedBytes, limitBytes, percent }
  }
  return result
}

// `docker info` succeeds only when both the CLI is on PATH and the daemon is
// reachable. exec reports a spawn failure as code -1 with the error message
// (ENOENT = CLI not installed) and a timeout as code -1 with no stderr, which
// is 'unknown' (keep the last known state) rather than 'stopped': under heavy
// daemon load `docker info` can be slow without the daemon being down.
export async function checkDockerStatus(exec: Exec): Promise<DockerStatus> {
  const r = await exec('docker', ['info', '--format', '{{.ID}}'], { timeoutMs: 5000 })
  if (r.code === 0) return 'running'
  if (r.errorCode === 'ENOENT') return 'not-installed'
  // A timeout is a slow daemon (e.g. mid compose deploy), not a stopped one:
  // 'unknown' tells the caller to keep its last known state.
  if (r.timedOut) return 'unknown'
  return 'stopped'
}

export async function listContainers(exec: Exec): Promise<DockerContainer[]> {
  try {
    const r = await exec('docker', ['ps', '-a', '--format', '{{json .}}'], { timeoutMs: 5000 })
    if (r.code !== 0) return []
    return parseContainers(r.stdout)
  } catch {
    return []
  }
}

// A separate, heavier call than listContainers(): `docker stats --no-stream`
// takes a CPU sample and typically costs ~1s, so callers only poll it when
// memory display is turned on.
export async function getContainerStats(exec: Exec): Promise<Record<string, DockerContainerStats>> {
  try {
    const r = await exec('docker', ['stats', '--no-stream', '--format', '{{json .}}'], { timeoutMs: 10000 })
    if (r.code !== 0) return {}
    return parseStats(r.stdout)
  } catch {
    return {}
  }
}

async function runAction(exec: Exec, bin: string, args: string[], fallback = 'Command failed'): Promise<DockerActionResult> {
  const r = await exec(bin, args)
  if (r.code === 0) return { ok: true }
  return { ok: false, error: r.stderr.trim() || fallback }
}

export const startContainer = (exec: Exec, id: string) => runAction(exec, 'docker', ['start', id])
export const stopContainer = (exec: Exec, id: string) => runAction(exec, 'docker', ['stop', id])
export const restartContainer = (exec: Exec, id: string) => runAction(exec, 'docker', ['restart', id])

// Batched equivalents for the panel's group and "all containers" controls:
// one docker invocation for the whole scope. start/stop on an id already in
// that state is a harmless no-op.
export const startContainers = (exec: Exec, ids: string[]) => runAction(exec, 'docker', ['start', ...ids])
export const stopContainers = (exec: Exec, ids: string[]) => runAction(exec, 'docker', ['stop', ...ids])
export const removeContainers = (exec: Exec, ids: string[]) => runAction(exec, 'docker', ['rm', '-f', ...ids])

// -f so a running container can be removed in one step.
export const removeContainer = (exec: Exec, id: string) => runAction(exec, 'docker', ['rm', '-f', id])

// Starting the daemon itself isn't a `docker` subcommand: it's whatever
// manages Docker Desktop/Colima/etc on the host, which differs per platform.
export async function openDockerApp(exec: Exec, platform: string = process.platform): Promise<DockerActionResult> {
  if (platform === 'darwin') return runAction(exec, 'open', ['-a', 'Docker'], 'Failed to start Docker — try starting it manually.')
  if (platform === 'linux') return runAction(exec, 'systemctl', ['--user', 'start', 'docker'], 'Failed to start Docker — try starting it manually.')
  return { ok: false, error: 'Unsupported platform' }
}

// The inverse of openDockerApp(): quits Docker Desktop (macOS) or stops the
// daemon (Linux). Stops every running container along with it.
export async function closeDockerApp(exec: Exec, platform: string = process.platform): Promise<DockerActionResult> {
  if (platform === 'darwin') return runAction(exec, 'osascript', ['-e', 'quit app "Docker"'], 'Failed to close Docker — try closing it manually.')
  if (platform === 'linux') return runAction(exec, 'systemctl', ['--user', 'stop', 'docker'], 'Failed to close Docker — try closing it manually.')
  return { ok: false, error: 'Unsupported platform' }
}
