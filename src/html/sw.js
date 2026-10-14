var CACHE_NAME = 'mathpath-v1';
var ASSETS = [
  './',
  './index.html',
  './admin.html',
  './session.html',
  './privacy.html',
  './terms.html',
  './manifest.json',
  './buildinfo.js',
  './index.js',
  './admin.js',
  './session.js',
  './styles.css',
  './bank.json',
  './papers.json'
];

function log(t) {
  try {
    console.log('[sw]', t);
  } catch (t) {}
}

function notifyClients(t) {
  return self.clients
    .matchAll({ includeUncontrolled: true })
    .then(function (n) {
      n.forEach(function (n) {
        n.postMessage(t);
      });
    })
    .catch(function () {});
}

function parseBuildInfo(t) {
  try {
    var n = t.indexOf('{');
    var e = t.lastIndexOf('}');
    return JSON.parse(t.slice(n, e + 1));
  } catch (t) {
    return null;
  }
}

function getCachedBuildInfo() {
  return caches
    .open(CACHE_NAME)
    .then(function (t) {
      return t.match('./buildinfo.js');
    })
    .then(function (t) {
      return t ? t.text() : null;
    })
    .then(function (t) {
      return t ? parseBuildInfo(t) : null;
    });
}

function checkForUpdate() {
  return fetch('./buildinfo.js', { cache: 'no-store' })
    .then(function (t) {
      return t.text();
    })
    .then(function (t) {
      var n = parseBuildInfo(t);
      if (!n) return;
      return getCachedBuildInfo().then(function (cached) {
        if (cached && cached.commit === n.commit) {
          log('up to date: ' + n.commit);
          notifyClients({ type: 'BUILD_STATUS', local: cached, remote: n, refreshed: false });
          return;
        } else {
          log('new build detected: ' + n.commit + ' (was ' + (cached && cached.commit) + ')');
          return refreshAllAssets(n);
        }
      });
    })
    .catch(function (t) {
      log('update check failed: ' + t);
    });
}

function refreshAllAssets(t) {
  return caches
    .open(CACHE_NAME)
    .then(function (cache) {
      return cache.keys().then(function (keys) {
        var urls = keys.map(function (k) {
          return k.url;
        });
        var toFetch = ASSETS.filter(function (a) {
          return urls.indexOf(a) === -1;
        });
        var requests = urls
          .map(function (u) {
            return fetch(u, { cache: 'reload' }).then(function (r) {
              if (r.ok) {
                log('refreshed ' + u);
                return cache.put(u, r);
              }
            });
          })
          .concat(
            toFetch.map(function (url) {
              return fetch(url).then(function (r) {
                if (r.ok) {
                  log('fetched ' + url);
                  return cache.put(url, r);
                }
              });
            })
          );
        return Promise.all(requests);
      });
    })
    .then(function () {
      log('refresh complete for ' + t.commit);
      notifyClients({ type: 'UPDATE_READY', buildInfo: t });
    });
}

self.addEventListener('install', function (evt) {
  log('install: starting, CACHE_NAME=' + CACHE_NAME);
  evt.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        log('caching ' + ASSETS.length + ' assets');
        return Promise.all(
          ASSETS.map(function (url) {
            return cache
              .add(url)
              .then(function () {
                log('cached: ' + url);
              })
              .catch(function (err) {
                log('cache FAILED: ' + url + ' - ' + err);
              });
          })
        );
      })
      .then(function () {
        return caches.open(CACHE_NAME).then(function (cache) {
          return fetch('./buildinfo.js', { cache: 'no-store' }).then(function (r) {
            if (r.ok) {
              log('cached buildinfo');
              return cache.put('./buildinfo.js', r);
            }
          });
        });
      })
      .then(function () {
        log('install: complete');
      })
  );
});

self.addEventListener('activate', function (evt) {
  log('activate: starting');
  evt.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key !== CACHE_NAME) {
              log('deleting old cache: ' + key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(function () {
        log('activate: clients.claim()');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (evt) {
  if (evt.request.mode === 'navigate') {
    evt.waitUntil(checkForUpdate());
  }
  evt.respondWith(
    caches
      .match(evt.request)
      .then(function (cached) {
        if (cached) {
          return cached;
        }
        return fetch(evt.request).then(function (res) {
          if (!res || res.status !== 200 || res.type !== 'basic') {
            return res;
          }
          var toCache = res.clone();
          caches
            .open(CACHE_NAME)
            .then(function (cache) {
              cache.put(evt.request, toCache);
            })
            .catch(function () {});
          return res;
        });
      })
      .catch(function () {
        return new Response('Offline', { status: 503 });
      })
  );
});

self.addEventListener('message', function (evt) {
  var data = evt.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') {
    log('SKIP_WAITING received');
    self.skipWaiting();
  } else if (data.type === 'CHECK_UPDATE') {
    checkForUpdate();
  }
});
