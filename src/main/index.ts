// main.js entry: registers the Docker handlers on the host's `vide.app`.
import type { MainVideApi } from '../vide'
import * as docker from './docker'

type Handle = { kill(): void }

export function activate(vide: MainVideApi): void {
  const exec: docker.Exec = (bin, args, opts) => vide.process.exec(bin, args, opts)
  const handle = (method: string, fn: (payload: any, ctx: { windowId: number }) => unknown) =>
    vide.app.handle(method, fn)

  handle('status', () => docker.checkDockerStatus(exec))
  handle('listContainers', () => docker.listContainers(exec))
  handle('startContainer', (id: string) => docker.startContainer(exec, id))
  handle('stopContainer', (id: string) => docker.stopContainer(exec, id))
  handle('restartContainer', (id: string) => docker.restartContainer(exec, id))
  handle('removeContainer', (id: string) => docker.removeContainer(exec, id))
  handle('startContainers', (ids: string[]) => docker.startContainers(exec, ids))
  handle('stopContainers', (ids: string[]) => docker.stopContainers(exec, ids))
  handle('removeContainers', (ids: string[]) => docker.removeContainers(exec, ids))
  handle('getContainerStats', () => docker.getContainerStats(exec))
  handle('openApp', () => docker.openDockerApp(exec))
  handle('closeApp', () => docker.closeDockerApp(exec))

  // ---- logs: one `docker logs -f` per streamId, tied to the requesting window ----
  const logProcs = new Map<string, { proc: Handle; windowId: number }>()

  function stopLogs(streamId: string): void {
    const entry = logProcs.get(streamId)
    if (!entry) return
    entry.proc.kill()
    logProcs.delete(streamId)
  }

  handle('runLogs', ({ streamId, containerId }: { streamId: string; containerId: string }, ctx) => {
    stopLogs(streamId)
    const windowId = ctx.windowId
    const send = (data: string) => vide.app.emit('log:data', { streamId, data }, { windowId })
    const proc = vide.process.spawn(
      'docker',
      ['logs', '-f', '--tail', '200', containerId],
      {
        onStdout: send,
        onStderr: send,
        onExit: (code) => {
          // A newer stream with the same id may have replaced this one.
          if (logProcs.get(streamId)?.proc === proc) logProcs.delete(streamId)
          vide.app.emit('log:exit', { streamId, code: code ?? 1 }, { windowId })
        },
      },
      { windowId },
    )
    logProcs.set(streamId, { proc, windowId })
  })

  handle('stopLogs', ({ streamId }: { streamId: string }) => stopLogs(streamId))

  // ---- watcher: one `docker events` stream per watching window ----
  const watchers = new Map<number, Handle>()

  function unwatch(windowId: number): void {
    watchers.get(windowId)?.kill()
    watchers.delete(windowId)
  }

  // If `docker events` dies (daemon stopped, docker uninstalled) it is not
  // reconnected: the renderer's poll covers staleness and the next `watch`
  // call spawns a fresh one.
  handle('watch', (_payload, ctx) => {
    const windowId = ctx.windowId
    if (watchers.has(windowId)) return true
    const proc = vide.process.spawn(
      'docker',
      ['events', '--format', '{{json .}}'],
      {
        onStdout: () => vide.app.emit('changed', undefined, { windowId }),
        onExit: () => { if (watchers.get(windowId) === proc) watchers.delete(windowId) },
      },
      { windowId },
    )
    watchers.set(windowId, proc)
    return true
  })

  handle('unwatch', (_payload, ctx) => { unwatch(ctx.windowId); return true })

  vide.windows.onClose((windowId) => {
    unwatch(windowId)
    for (const [streamId, entry] of [...logProcs]) {
      if (entry.windowId === windowId) stopLogs(streamId)
    }
  })

  disposeAll = () => {
    for (const id of [...watchers.keys()]) unwatch(id)
    for (const id of [...logProcs.keys()]) stopLogs(id)
  }
}

let disposeAll: () => void = () => {}

export function deactivate(): void {
  disposeAll()
}
