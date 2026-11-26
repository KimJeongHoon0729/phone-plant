// 한 번 열면 인터넷 없이도 앱이 열리도록 파일을 저장해 둬요.
// 파일을 고친 뒤 배포할 때는 아래 버전 숫자를 올려주세요.
const CACHE = 'phone-plant-v1';
const FILES = ['./', 'index.html', 'style.css', 'plant.js', 'storage.js', 'app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
