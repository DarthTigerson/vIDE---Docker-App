import { useCallback } from 'react'
import { getVide } from './vide'

// A container's `docker logs -f` output in a read-only terminal.
export function DockerLogTerminal({ containerId }: { containerId: string }) {
  const start = useCallback((write: (chunk: string) => void) => {
    const vide = getVide()
    const streamId = `docker-logs-${containerId}-${Date.now().toString(36)}`
    let streaming = true
    const offData = vide.app.on('log:data', (p) => {
      const e = p as { streamId: string; data: string }
      if (e.streamId === streamId) write(e.data)
    })
    const offExit = vide.app.on('log:exit', (p) => {
      if ((p as { streamId: string }).streamId === streamId) streaming = false
    })
    void vide.app.call('runLogs', { streamId, containerId })
    return () => {
      offData()
      offExit()
      if (streaming) void vide.app.call('stopLogs', { streamId })
    }
  }, [containerId])

  const View = getVide().terminal.View
  return <View start={start} streamKey={containerId} zoomKey={`logs-${containerId}`} placeholder="Waiting for output…" />
}
