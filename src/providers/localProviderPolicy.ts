/** Native platform choice is authoritative. A stale development preference must
 * never put a mock provider into the normal native assistant experience. */
export function localProviderId({ appleId, nativeWindows, browserUnavailableId, configuredId, storedId, defaultId }: {
  appleId?: string
  nativeWindows: boolean
  browserUnavailableId?: string
  configuredId?: string
  storedId?: string
  defaultId: string
}): string {
  return appleId ?? (nativeWindows ? 'foundry-local' : browserUnavailableId ?? configuredId ?? storedId ?? defaultId)
}
