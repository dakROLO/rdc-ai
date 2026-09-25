const CACHE_NAME = 'rdc-ai-shell-v2'
const CORE_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/rdc-ai-mark.svg',
  '/icons/rdc-ai-192.png',
  '/icons/rdc-ai-512.png',
]

async function precacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME)
  await cache.addAll(CORE_SHELL)

  // Vite production assets are content-hashed. Discover the built JS/CSS
  // references from index.html at install time so the first installed
  // service worker can cache the actual production shell.
  const indexResponse = await fetch('/index.html', { cache: 'no-store' })
  const html = await indexResponse.text()
  const assetUrls = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map((match) => match[1])

  if (assetUrls.length > 0) {
    await cache.addAll([...new Set(assetUrls)])
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApplicationShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached

        if (request.mode === 'navigate') {
          return caches.match('/index.html')
        }

        return Response.error()
      }),
  )
})
