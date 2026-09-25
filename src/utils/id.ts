export function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    const uuid = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-')

    return `${prefix}_${uuid}`
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}
