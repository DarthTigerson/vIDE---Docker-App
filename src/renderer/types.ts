// Shapes returned by main.js (see src/main/docker.ts).
export type DockerStatus = 'not-installed' | 'stopped' | 'running' | 'unknown'

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: string
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
