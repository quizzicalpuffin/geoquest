/* Word Attack FC / Word Vault GC — offline shell.
   Bump CACHE when a new build is uploaded; the old cache is then deleted and
   the new page fetched once. Network-first for the pages themselves so an
   update is never more than one load away, cache-first for the icons. */
var CACHE = "wordgames-v3";
var SHELL = [
  "wordattack.html",
  "wordvault.html",
  "icons/apple-touch-icon.png",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons2/apple-touch-icon.png",
  "icons2/icon-180.png",
  "icons2/icon-192.png",
  "icons2/icon-512.png",
  "manifest.webmanifest",
  "manifest-vault.webmanifest"
];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    // one missing file must not sink the whole install
    return Promise.all(SHELL.map(function(u){
      return c.add(new Request(u, {cache:"reload"})).catch(function(){});
    }));
  }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ return k===CACHE ? null : caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  var req=e.request;
  if(req.method!=="GET") return;
  var url=new URL(req.url);
  if(url.origin!==location.origin) return;          // never touch anything off-site

  var isPage = req.mode==="navigate" || /\.html?$/.test(url.pathname);
  if(isPage){
    // fresh if we can reach the network, cached if we cannot
    e.respondWith(
      fetch(req).then(function(res){
        var copy=res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        // exact match first, then the same page ignoring any ?query, and never
        // the other child's app as a stand-in
        return caches.match(req).then(function(hit){
          if(hit) return hit;
          return caches.match(req, {ignoreSearch:true}).then(function(hit2){
            if(hit2) return hit2;
            return new Response(
              "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"+
              "<style>body{font:17px -apple-system,sans-serif;padding:2em;color:#25303a;background:#F7F0E1}</style>"+
              "<h1>Not saved for offline yet</h1>"+
              "<p>Open this page once with a signal and it will work without one after that.</p>",
              { headers:{ "Content-Type":"text/html; charset=utf-8" } });
          });
        });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){
        if(res && res.status===200){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
    })
  );
});
