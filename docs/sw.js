// Retire the former public PWA when an existing installation reconnects.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(key=>key.startsWith('touchline-')).map(key=>caches.delete(key)));
  await self.registration.unregister();
  for(const client of await self.clients.matchAll({type:'window'}))await client.navigate(new URL('./',self.location.href).href);
})()));
