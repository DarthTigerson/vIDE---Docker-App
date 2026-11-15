import { describe, it, expect, vi, beforeEach } from 'vitest'
import { activate, deactivate } from '../index'
import type { MainVideApi } from '../../vide'

type Handlers = { onStdout?(c: string): void; onStderr?(c: string): void; onExit?(code: number | null): void }

function makeFake() {
  const handlers = new Map<string, (p: any, ctx: { windowId: number }) => any>()
  const emits: { event: string; payload: unknown; opts?: { windowId?: number } }[] = []
  const spawns: { bin: string; args: string[]; h: Handlers; opts?: { windowId?: number }; kill: ReturnType<typeof vi.fn> }[] = []
  let closeCb: (id: number) => void = () => {}
  const exec = vi.fn(async (_b: string, _a: string[]) : Promise<{ code: number; stdout: string; stderr: string; timedOut?: boolean; errorCode?: string }> => ({ code: 0, stdout: '', stderr: '' }))
  const vide = {
    apiVersion: 1,
    appId: 'docker',
    app: {
      handle: (m, fn) => { handlers.set(m, fn); return () => handlers.delete(m) },
      emit: (event, payload, opts) => { emits.push({ event, payload, opts }) },
    },
    process: {
      exec,
      spawn: (bin, args, h, opts) => {
        const kill = vi.fn()
        spawns.push({ bin, args, h, opts, kill })
        return { kill }
      },
    },
    windows: { onClose: (cb) => { closeCb = cb; return () => {} } },
  } as MainVideApi
  return { vide, handlers, emits, spawns, exec, close: (id: number) => closeCb(id) }
}

describe('main activate', () => {
  let f: ReturnType<typeof makeFake>
  beforeEach(() => { f = makeFake(); activate(f.vide) })
  const call = (m: string, p: unknown, windowId = 1) => f.handlers.get(m)!(p, { windowId })

  it('registers every handler', () => {
    for (const m of ['status', 'listContainers', 'startContainer', 'stopContainer', 'restartContainer', 'removeContainer',
      'startContainers', 'stopContainers', 'removeContainers', 'getContainerStats', 'openApp', 'closeApp',
      'runLogs', 'stopLogs', 'watch', 'unwatch']) expect(f.handlers.has(m), m).toBe(true)
  })

  it('status: running / not-running / not-installed', async () => {
    expect(await call('status', undefined)).toBe('running')
    f.exec.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'Cannot connect' })
    expect(await call('status', undefined)).toBe('stopped')
    f.exec.mockResolvedValueOnce({ code: -1, stdout: '', stderr: 'spawn docker ENOENT', errorCode: 'ENOENT' })
    expect(await call('status', undefined)).toBe('not-installed')
  })

  it('listContainers goes through docker ps -a', async () => {
    f.exec.mockResolvedValueOnce({ code: 0, stderr: '', stdout: JSON.stringify({ ID: 'a', Names: 'n', Image: 'i', Status: 's', State: 'running', Ports: '' }) })
    const list = await call('listContainers', undefined)
    expect(f.exec.mock.calls[0].slice(0, 2)).toEqual(['docker', ['ps', '-a', '--format', '{{json .}}']])
    expect(list).toHaveLength(1)
  })

  it('runLogs spawns docker logs for that window and emits only to it', () => {
    call('runLogs', { streamId: 's1', containerId: 'abc' }, 7)
    const s = f.spawns[0]
    expect(s.bin).toBe('docker')
    expect(s.args).toEqual(['logs', '-f', '--tail', '200', 'abc'])
    expect(s.opts).toEqual({ windowId: 7 })
    s.h.onStdout!('out')
    s.h.onStderr!('err')
    s.h.onExit!(null)
    expect(f.emits).toEqual([
      { event: 'log:data', payload: { streamId: 's1', data: 'out' }, opts: { windowId: 7 } },
      { event: 'log:data', payload: { streamId: 's1', data: 'err' }, opts: { windowId: 7 } },
      { event: 'log:exit', payload: { streamId: 's1', code: 1 }, opts: { windowId: 7 } },
    ])
  })

  it('stopLogs kills the stream; re-running the same id kills the old one', () => {
    call('runLogs', { streamId: 's1', containerId: 'a' })
    call('runLogs', { streamId: 's1', containerId: 'a' })
    expect(f.spawns[0].kill).toHaveBeenCalledTimes(1)
    call('stopLogs', { streamId: 's1' })
    expect(f.spawns[1].kill).toHaveBeenCalledTimes(1)
  })

  it('watch spawns docker events once per window and emits changed to it', () => {
    call('watch', undefined, 3)
    call('watch', undefined, 3)
    call('watch', undefined, 4)
    expect(f.spawns).toHaveLength(2)
    expect(f.spawns[0].args).toEqual(['events', '--format', '{{json .}}'])
    f.spawns[0].h.onStdout!('{}')
    expect(f.emits).toEqual([{ event: 'changed', payload: undefined, opts: { windowId: 3 } }])
    call('unwatch', undefined, 3)
    expect(f.spawns[0].kill).toHaveBeenCalled()
    expect(f.spawns[1].kill).not.toHaveBeenCalled()
  })

  it('window close kills that window\'s watcher and logs only', () => {
    call('watch', undefined, 1)
    call('watch', undefined, 2)
    call('runLogs', { streamId: 'a', containerId: 'x' }, 1)
    call('runLogs', { streamId: 'b', containerId: 'y' }, 2)
    f.close(1)
    expect(f.spawns[0].kill).toHaveBeenCalled()
    expect(f.spawns[2].kill).toHaveBeenCalled()
    expect(f.spawns[1].kill).not.toHaveBeenCalled()
    expect(f.spawns[3].kill).not.toHaveBeenCalled()
  })

  it('deactivate kills everything', () => {
    call('watch', undefined, 1)
    call('runLogs', { streamId: 'a', containerId: 'x' }, 1)
    deactivate()
    expect(f.spawns.every((s) => s.kill.mock.calls.length === 1)).toBe(true)
  })
})
