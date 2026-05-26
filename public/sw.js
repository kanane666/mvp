// MVP Basket — Service Worker
// VERSION est injectée par le script de build (ou date de déploiement)
// Le nom du cache change à chaque déploiement → l'ancienne version est purgée automatiquement

const BUILD_TIME = '__BUILD_TIME__'; // remplacé au build
const CACHE = `mvp-basket-${BUILD_TIME}`;

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  // skipWaiting = prend le contrôle immédiatement sans attendre la fermeture de l'onglet
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(['/', '/index.html']).catch(() => {})
    )
  );
});

// ── Activate : purge TOUS les anciens caches ──────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => {
            console.log('[SW] Suppression ancien cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      // Prend le contrôle de tous les onglets ouverts immédiatement
      return self.clients.claim();
    })
  );
});

// ── Message : demande de mise à jour forcée depuis l'app ──────────────────────
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'FORCE_REFRESH') {
    // Vide tout le cache pour forcer le rechargement complet
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et cross-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  // Ignorer les requêtes Supabase
  if (url.hostname.includes('supabase')) return;

  // Assets versionnés (JS/CSS avec hash) : cache-first, durée infinie
  // (les noms changent à chaque build, donc jamais de fichier périmé)
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML / navigation : network-first (toujours la dernière version si en ligne)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Tout le reste : network-first avec fallback cache
  e.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
