const CACHE='touchline-v19';
const ASSETS=['./','./index.html','./styles.css','./engine.mjs','./app.mjs','./preferences.mjs','./sounds.mjs','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./audio/referee.mp3','./audio/crowd.mp3','./audio/minute.mp3','./audio/count-1.mp3','./audio/count-2.mp3','./audio/count-3.mp3','./audio/count-4.mp3','./audio/count-5.mp3','./audio/CREDITS.txt'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('touchline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
