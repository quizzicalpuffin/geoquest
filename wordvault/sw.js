/* Word Vault GC — offline. Its own folder, its own scope, its own cache.
   It must never serve Tom's app as a fallback. */
var CACHE = "wordvault-v2";
var SCOPE = new URL("./", self.location).href;
var SHELL = ["./", "index.html"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
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
  if(req.url.indexOf(SCOPE)!==0) return;
  var isPage = req.mode==="navigate" || /\.html?$/.test(new URL(req.url).pathname) || req.url===SCOPE;
  if(isPage){
    e.respondWith(fetch(req).then(function(res){
      var copy=res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy); });
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        if(hit) return hit;
        return caches.match(req,{ignoreSearch:true}).then(function(h2){
          if(h2) return h2;
          return caches.match(SCOPE+"index.html").then(function(h3){
            return h3 || new Response("<!doctype html><h1>Not saved for offline yet</h1>",
              {headers:{"Content-Type":"text/html; charset=utf-8"}});
          });
        });
      });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function(hit){
    return hit || fetch(req).then(function(res){
      if(res && res.status===200){ var c2=res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, c2); }); }
      return res;
    }).catch(function(){ return hit; });
  }));
});
