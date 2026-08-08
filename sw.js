/* Service worker de Skull King Score.
   Stratégie : réseau d'abord pour la page (pour recevoir les mises à jour),
   cache d'abord pour les icônes et le manifeste. Les données de jeu vivent
   dans localStorage et ne sont jamais touchées par ce cache. */
const VERSION = 'sk-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png', './icons/maskable-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;

  const isDoc = req.mode === 'navigate' || (req.destination === 'document');
  if(isDoc){
    // réseau d'abord : une nouvelle version déployée est prise au prochain lancement
    e.respondWith(
      fetch(req)
        .then(res=>{ const copy=res.clone(); caches.open(VERSION).then(c=>c.put('./index.html', copy)); return res; })
        .catch(()=>caches.match('./index.html').then(r=>r || caches.match('./')))
    );
    return;
  }
  // reste : cache d'abord, rafraîchi en arrière-plan
  e.respondWith(
    caches.match(req).then(hit=>{
      const net = fetch(req).then(res=>{
        const copy=res.clone(); caches.open(VERSION).then(c=>c.put(req, copy)); return res;
      }).catch(()=>hit);
      return hit || net;
    })
  );
});
