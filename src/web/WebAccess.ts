import type { WebAccessMode } from '../tools/ToolRegistry.ts'

export const WEB_ACCESS_STORAGE_KEY = 'crownkeep.webAccess.v1'

export function readWebAccessMode(
  storage: Pick<Storage, 'getItem'>,
): WebAccessMode {
  return storage.getItem(WEB_ACCESS_STORAGE_KEY) === 'on' ? 'on' : 'off'
}

export function saveWebAccessMode(
  storage: Pick<Storage, 'setItem'>,
  mode: WebAccessMode,
): void {
  storage.setItem(WEB_ACCESS_STORAGE_KEY, mode)
}
