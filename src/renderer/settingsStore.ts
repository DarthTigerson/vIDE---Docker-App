import { create } from 'zustand'
import { getVide } from './vide'

// Keys are app-relative: vIDE stores them as `vide:docker:<key>`, so the
// built-in Docker feature's settings carry over unchanged.
const SHOW_BADGE_KEY = 'showBadge'
const BADGE_MODE_KEY = 'badgeMode'
const SHOW_MEMORY_KEY = 'showMemory'
const MEMORY_FORMAT_KEY = 'memoryFormat'

// What the activity-bar badge counts: every running container ("pods"),
// or the number of distinct Compose projects with at least one running
// container. Standalone (non-Compose) containers have no project, so they
// don't contribute to the 'projects' count.
export type DockerBadgeMode = 'containers' | 'projects'

// How each container row's memory usage is displayed.
export type DockerMemoryFormat = 'usedPercent' | 'availablePercent' | 'usedAbsolute' | 'usedOverLimit'

const MEMORY_FORMATS: DockerMemoryFormat[] = ['usedPercent', 'availablePercent', 'usedAbsolute', 'usedOverLimit']

export function parseBool(value: string | null, def: boolean): boolean {
  return value === null ? def : value === 'true'
}

export function parseBadgeMode(value: string | null, def: DockerBadgeMode): DockerBadgeMode {
  return value === 'containers' || value === 'projects' ? value : def
}

export function parseMemoryFormat(value: string | null, def: DockerMemoryFormat): DockerMemoryFormat {
  return (MEMORY_FORMATS as string[]).includes(value ?? '') ? (value as DockerMemoryFormat) : def
}

interface DockerSettingsStore {
  showBadge: boolean
  setShowBadge: (value: boolean) => void
  badgeMode: DockerBadgeMode
  setBadgeMode: (value: DockerBadgeMode) => void
  // Off by default: unlike the badge (which reuses the container list the
  // panel already fetches), memory display needs its own `docker stats`
  // poll, a noticeably heavier command, so it's opt-in rather than free.
  showMemory: boolean
  setShowMemory: (value: boolean) => void
  memoryFormat: DockerMemoryFormat
  setMemoryFormat: (value: DockerMemoryFormat) => void
}

export const useDockerSettingsStore = create<DockerSettingsStore>((set) => ({
  showBadge: true,
  badgeMode: 'containers',
  showMemory: false,
  memoryFormat: 'usedPercent',

  setShowBadge: (value) => {
    getVide().settings.set(SHOW_BADGE_KEY, String(value))
    set({ showBadge: value })
  },
  setBadgeMode: (value) => {
    getVide().settings.set(BADGE_MODE_KEY, value)
    set({ badgeMode: value })
  },
  setShowMemory: (value) => {
    getVide().settings.set(SHOW_MEMORY_KEY, String(value))
    set({ showMemory: value })
  },
  setMemoryFormat: (value) => {
    getVide().settings.set(MEMORY_FORMAT_KEY, value)
    set({ memoryFormat: value })
  },
}))

// Loads the persisted values and keeps the store in step with later writes
// (another window's change, a settings sync). Returns the unsubscribe.
export function initDockerSettings(): () => void {
  const s = getVide().settings
  const apply = () => useDockerSettingsStore.setState({
    showBadge: parseBool(s.get(SHOW_BADGE_KEY), true),
    badgeMode: parseBadgeMode(s.get(BADGE_MODE_KEY), 'containers'),
    showMemory: parseBool(s.get(SHOW_MEMORY_KEY), false),
    memoryFormat: parseMemoryFormat(s.get(MEMORY_FORMAT_KEY), 'usedPercent'),
  })
  apply()
  const offs = [SHOW_BADGE_KEY, BADGE_MODE_KEY, SHOW_MEMORY_KEY, MEMORY_FORMAT_KEY].map((k) => s.subscribe(k, apply))
  return () => offs.forEach((off) => off())
}
