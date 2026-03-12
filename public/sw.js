// Service Worker mínimo para habilitar instalação PWA
const CACHE_NAME = 'transnet-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Estratégia network-first: sempre busca do servidor, fallback no cache
self.addEventListener('fetch', (event) => {
    // Ignora requisições não-GET e socket.io
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/socket.io/')) return;
    if (event.request.url.includes('/api/')) return;
    // Ignora requisições para domínios externos (fonts, CDN, analytics)
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cacheia apenas respostas válidas de assets estáticos
                if (response.ok && event.request.url.match(/\.(js|css|png|ico|json)$/)) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
