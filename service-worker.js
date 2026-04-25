// ================== DocBook Nurse — Service Worker ==================
// استراتيجية: Network First للـ Firebase، Cache First للأصول الثابتة

const CACHE_NAME = 'docbook-nurse-v1';
const CACHE_VERSION = 1;

// الأصول الثابتة التي تُخزَّن مؤقتاً
const STATIC_ASSETS = [
  './nurse.html',
  './nurse-style.css',
  './nurse-app.js',
  './nurse-alerts.js',
  './nurse-login.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── Install: تخزين الأصول الثابتة ──
self.addEventListener('install', event => {
  console.log('[SW] Installing DocBook Nurse v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache install error:', err))
  );
});

// ── Activate: حذف الكاشات القديمة ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating DocBook Nurse v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: استراتيجية ذكية حسب نوع الطلب ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Firebase و CDN خارجي → Network Only (لا كاش)
  const isExternal =
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.google.com') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isExternal) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // الأصول الثابتة (HTML, CSS, JS, Images) → Cache First, Network Fallback
  if (
    request.method === 'GET' &&
    (url.pathname.endsWith('.html') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.jpg') ||
     url.pathname.endsWith('.json'))
  ) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) {
            // تحديث الكاش في الخلفية (Stale While Revalidate)
            fetch(request)
              .then(fresh => {
                caches.open(CACHE_NAME).then(cache => cache.put(request, fresh.clone()));
              })
              .catch(() => {});
            return cached;
          }
          // مش موجود في الكاش → اطلبه من الشبكة واحفظه
          return fetch(request).then(fresh => {
            const toCache = fresh.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
            return fresh;
          });
        })
        .catch(() => caches.match('./nurse.html')) // fallback للصفحة الرئيسية
    );
    return;
  }

  // كل شيء ثاني → Network First
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── Message: استقبال أوامر من التطبيق ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared');
    });
  }
});
