import { isTauri } from '@tauri-apps/api/core'
import { browserLocalRuntimeManager } from './BrowserLocalRuntimeManager.ts'
import type { LocalRuntimeManager } from './LocalRuntimeManager.ts'
import { TauriLocalRuntimeManager } from './TauriLocalRuntimeManager.ts'

export const localRuntimeManager: LocalRuntimeManager = isTauri()
  ? new TauriLocalRuntimeManager()
  : browserLocalRuntimeManager
