export function registerServiceWorker(): void {
  if (
    !('serviceWorker' in navigator) ||
    import.meta.env.DEV ||
    !['http:', 'https:'].includes(window.location.protocol)
  ) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('RDC AI service worker registration failed.', error)
    })
  })
}
