import { describe, it, expect } from 'vitest'
import {
  checkDockerStatus, listContainers, getContainerStats, parseComposeProject, parseMemValue,
  removeContainer, stopContainers, openDockerApp, type Exec,
} from '../docker'

const execReturning = (r: { code: number; stdout?: string; stderr?: string; timedOut?: boolean; errorCode?: string }): Exec =>
  async () => ({ ...r, stdout: r.stdout ?? '', stderr: r.stderr ?? '' })

describe('checkDockerStatus', () => {
  it('running when docker info succeeds', async () => {
    expect(await checkDockerStatus(execReturning({ code: 0, stdout: 'ID' }))).toBe('running')
  })
  it('not-installed on a spawn ENOENT', async () => {
    expect(await checkDockerStatus(execReturning({ code: -1, stderr: 'spawn docker ENOENT', errorCode: 'ENOENT' }))).toBe('not-installed')
  })
  it('stopped when the CLI ran and failed', async () => {
    expect(await checkDockerStatus(execReturning({ code: 1, stderr: 'Cannot connect to the Docker daemon' }))).toBe('stopped')
  })
  it('unknown on a timeout, even with partial stderr', async () => {
    expect(await checkDockerStatus(execReturning({ code: -1, stderr: 'partial', timedOut: true }))).toBe('unknown')
  })
  it('asks for a 5s timeout', async () => {
    let seen: unknown
    await checkDockerStatus(async (_b, _a, o) => { seen = o; return { code: 0, stdout: '', stderr: '' } })
    expect(seen).toEqual({ timeoutMs: 5000 })
  })
})

describe('listContainers', () => {
  it('parses docker ps json lines and the compose project label', async () => {
    const lines = [
      { ID: 'a1', Names: 'web', Image: 'nginx', Status: 'Up 1m', State: 'running', Ports: '80/tcp', Labels: 'x=y,com.docker.compose.project=shop' },
      { ID: 'b2', Names: 'solo', Image: 'redis', Status: 'Exited', State: 'exited', Ports: '', Labels: '' },
    ].map((o) => JSON.stringify(o)).join('\n') + '\n'
    const list = await listContainers(execReturning({ code: 0, stdout: lines }))
    expect(list).toEqual([
      { id: 'a1', name: 'web', image: 'nginx', status: 'Up 1m', state: 'running', ports: '80/tcp', project: 'shop' },
      { id: 'b2', name: 'solo', image: 'redis', status: 'Exited', state: 'exited', ports: '', project: undefined },
    ])
  })
  it('returns [] on failure or bad output', async () => {
    expect(await listContainers(execReturning({ code: 1 }))).toEqual([])
    expect(await listContainers(execReturning({ code: 0, stdout: 'not json' }))).toEqual([])
  })
})

describe('getContainerStats / parsing helpers', () => {
  it('parses memory usage and limits', async () => {
    const out = JSON.stringify({ ID: 'a1', MemUsage: '512MiB / 2GiB', MemPerc: '25.00%' })
    const stats = await getContainerStats(execReturning({ code: 0, stdout: out }))
    expect(stats.a1).toEqual({ usedBytes: 512 * 1024 ** 2, limitBytes: 2 * 1024 ** 3, percent: 25 })
  })
  it('parseMemValue handles garbage and unknown units', () => {
    expect(parseMemValue('??')).toBe(0)
    expect(parseMemValue('3 XB')).toBe(3)
  })
  it('parseComposeProject', () => {
    expect(parseComposeProject(undefined)).toBeUndefined()
    expect(parseComposeProject('a=b,com.docker.compose.project=p')).toBe('p')
  })
})

describe('actions', () => {
  it('ok on exit 0, stderr on failure', async () => {
    expect(await removeContainer(execReturning({ code: 0 }), 'x')).toEqual({ ok: true })
    expect(await stopContainers(execReturning({ code: 1, stderr: ' nope \n' }), ['x'])).toEqual({ ok: false, error: 'nope' })
    expect(await stopContainers(execReturning({ code: 1 }), ['x'])).toEqual({ ok: false, error: 'Command failed' })
  })
  it('builds batched args', async () => {
    let args: string[] = []
    await removeContainer(async (_b, a) => { args = a; return { code: 0, stdout: '', stderr: '' } }, 'c1')
    expect(args).toEqual(['rm', '-f', 'c1'])
  })
  it('openDockerApp uses the platform launcher', async () => {
    const calls: string[][] = []
    const exec: Exec = async (b, a) => { calls.push([b, ...a]); return { code: 0, stdout: '', stderr: '' } }
    await openDockerApp(exec, 'darwin')
    await openDockerApp(exec, 'linux')
    expect(calls).toEqual([['open', '-a', 'Docker'], ['systemctl', '--user', 'start', 'docker']])
    expect(await openDockerApp(exec, 'win32')).toEqual({ ok: false, error: 'Unsupported platform' })
  })
})
