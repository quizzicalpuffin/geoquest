/* Word Attack FC — offline.
   Lives in its own folder so it has its own scope. Sharing a folder with
   another app means sharing one service worker, which is why this did not
   work before: the page was registering the geography app's worker.

   Pages are network-first, so a new upload always lands. Everything else is
   cache-first. Bump CACHE when the shell changes. */
var CACHE = "wordattack-v2";
var SCOPE = new URL("./", self.location).href;
var SHELL = [
  "./",                       // the folder URL, which is what a shortcut usually opens
  "index.html",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(SHELL.map(function(u){        // one bad file must not sink the install
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
  if(req.url.indexOf(SCOPE)!==0) return;      // anything outside this folder is none of our business

  var isPage = req.mode==="navigate" || /\.html?$/.test(new URL(req.url).pathname) ||
               req.url===SCOPE;
  if(isPage){
    e.respondWith(
      fetch(req).then(function(res){
        var copy=res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          if(hit) return hit;
          return caches.match(req, {ignoreSearch:true}).then(function(h2){
            if(h2) return h2;
            return caches.match(SCOPE+"index.html").then(function(h3){   // same app, never another
              if(h3) return h3;
              return new Response(
                "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"+
                "<style>body{font:17px -apple-system,sans-serif;padding:2em;color:#25303a;background:#F7F0E1}</style>"+
                "<h1>Not saved for offline yet</h1>"+
                "<p>Open this once with a signal and it will work without one after that.</p>",
                { headers:{ "Content-Type":"text/html; charset=utf-8" } });
            });
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
