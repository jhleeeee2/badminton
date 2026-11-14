// sw.js — 홈 화면 설치(PWA)·오프라인용 서비스 워커
//   네트워크 우선: 인터넷이 되면 항상 최신 파일을 받고 사본을 저장, 안 되면 저장해 둔 사본으로 실행
//   (캐시 우선이 아니라서 새로 배포해도 옛 버전이 남지 않음). 같은 주소의 GET 요청만 다룸 — Supabase 통신은 건드리지 않음
const CACHE = 'badminton-rally-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});
