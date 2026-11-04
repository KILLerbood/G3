// Magmafy CRM service worker: makes the installed app open without a connection.
// The build fills in VERSION and PRECACHE (vite.config.ts → prodHtml). API calls (script.google.com) are never cached.
const VERSION = "01ba38efe5";
const PRECACHE = ["./apple-touch-icon.png","./assets/ActivityFeed-SJMUkNf7.js","./assets/AnnouncementEditor-CfT9C1qo.js","./assets/Announcements-CEty_Om5.js","./assets/BillingHub-BpszHEXy.js","./assets/BillingTab-B4Iup7Jv.js","./assets/BookingModal-CKWMTiVN.js","./assets/Client360-BDY8MvzX.js","./assets/Companies-Cc_d0vnh.js","./assets/Contacts-DpiZaofb.js","./assets/Delivery-BcROryN4.js","./assets/Desk-C3v9zjEN.js","./assets/DocPage-Bw4IIAV0.js","./assets/Inbox-_AqImqhA.js","./assets/LeadView-CnYrtZnJ.js","./assets/NewThreadModal-CsdFz1i6.js","./assets/Pipeline-CoOwwIxV.js","./assets/Portfolio-DLb1QPHD.js","./assets/Profile-CdQKjEir.js","./assets/ReminderModal-DUQ2Nkjv.js","./assets/Reports-DnsKkZxA.js","./assets/SalesTools-CacSuiRC.js","./assets/Schedule-DvgXXjr3.js","./assets/Sequences-BNGNZV45.js","./assets/Settings-BJVhG4Z2.js","./assets/Tasks-cNW5Omm6.js","./assets/Templates-CzHSGbOt.js","./assets/ThreadView-BUIxL2-s.js","./assets/cards-DPVgAO_a.js","./assets/data-D1dBHi58.js","./assets/el-messiri-arabic-500-normal-D6j8R5ND.woff2","./assets/el-messiri-arabic-600-normal-Te2c8S-M.woff2","./assets/el-messiri-arabic-700-normal-D9aO7CWn.woff2","./assets/flow-DK8ok5jS.js","./assets/hooks-DPlUDd9o.js","./assets/index-BpY6rgxE.css","./assets/index-DUHn6ZO4.js","./assets/inter-latin-ext-wght-normal-CFHvXkgd.woff2","./assets/inter-latin-wght-normal-C2S99t-D.woff2","./assets/metrics-TxRhJV0T.js","./assets/modals-BNvY2TAj.js","./assets/query-d9EJHOc_.js","./assets/radix-BcVAIGPp.js","./assets/react-CPov65gV.js","./assets/render-DvEN9J83.js","./assets/server-D48yahTu.js","./assets/space-grotesk-latin-ext-wght-normal-OnFqUBEL.woff2","./assets/space-grotesk-latin-wght-normal-5PZORFv8.woff2","./assets/tajawal-arabic-400-normal-CyCXRvzh.woff2","./assets/tajawal-arabic-500-normal-BZ8ojJNu.woff2","./assets/tajawal-arabic-700-normal-D2-eand5.woff2","./assets/tajawal-arabic-800-normal-TQp-UTiE.woff2","./assets/tajawal-latin-400-normal-BVNSOH3d.woff2","./assets/tajawal-latin-500-normal-CoYeBiSI.woff2","./assets/tajawal-latin-700-normal-BypgxfGb.woff2","./assets/tajawal-latin-800-normal-CmI34b-g.woff2","./assets/three-l0sNRNKZ.js","./favicon.png","./icon-192.png","./icon-96.png","./icon-maskable-192.png","./manifest.webmanifest"];
const CACHE = 'mg-crm-' + VERSION;
const SHELL = new URL('./', self.registration.scope).href;

self.addEventListener('install', (e) => {
  // Every file of this version, so pages opened for the first time offline still work.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(['./', ...PRECACHE].map((u) => c.add(u).catch(() => {})))));
});

// A new version waits until the user taps «حدّث» (or every tab is closed), so a page in use never loses its files.
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('mg-crm-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Network first (always the latest page), the saved shell when offline.
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(SHELL, copy)); }
      return res;
    }).catch(() => caches.match(SHELL).then((r) => r || caches.match(new URL('index.html', self.registration.scope).href))));
    return;
  }
  if (/\.(js|css|woff2|svg|png|webp|jpg|webmanifest)$/.test(url.pathname)) {
    // Hashed files never change: cache first.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});

// ---- Push notifications ------------------------------------------------------------------------
// The push carries no data: it only wakes this worker, which asks the server (crmPushPull) what is new,
// with the session the app left in the «mg-auth» cache (src/lib/push.ts). Every push must show something.
const AUTH_URL = new URL('__mg_auth', self.registration.scope).href;
const ICON = new URL('icon-192.png', self.registration.scope).href;
const BADGE = new URL('icon-96.png', self.registration.scope).href;

async function readAuth() {
  try { const r = await (await caches.open('mg-auth')).match(AUTH_URL); return r ? await r.json() : null; } catch { return null; }
}

async function pull(auth) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(auth.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'crm', fn: 'crmPushPull', args: [], token: auth.token }), signal: ctrl.signal });
    const env = await res.json();
    return env && env.ok && env.data && Array.isArray(env.data.items) ? env.data.items : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

async function showPending() {
  const auth = await readAuth();
  const items = auth && auth.api && auth.token ? await pull(auth) : null;
  const show = (n) => self.registration.showNotification(n.title, { body: n.body, tag: n.id, icon: ICON, badge: BADGE, lang: 'ar', dir: 'rtl', data: { url: n.url } });
  if (items && items.length) {
    // Ones already on screen keep their tag; if all of them are, the newest is put up again quietly
    // (Safari and Chrome expect every push to show a notification).
    const shown = await self.registration.getNotifications();
    const fresh = items.filter((n) => !shown.some((s) => s.tag === n.id));
    await Promise.all((fresh.length ? fresh : items.slice(0, 1)).slice().reverse().map(show));
    return;
  }
  // Nothing to fetch (offline, signed out, or already read): a short note, never silence.
  await self.registration.showNotification('Magmafy', {
    body: auth ? 'فيه جديد في Magmafy، افتح التطبيق' : 'افتح Magmafy وسجّل دخول عشان تشوف التنبيهات', tag: 'mg-generic', icon: ICON, badge: BADGE, lang: 'ar', dir: 'rtl', data: { url: '#/' }
  });
}

self.addEventListener('push', (e) => { e.waitUntil(showPending()); });

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || '#/', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    // An open window just moves to the page (src/lib/push.ts listens); otherwise the app opens on it.
    const win = list.find((c) => c.url.startsWith(self.registration.scope));
    if (win) { win.postMessage({ type: 'mg-open', hash: new URL(target).hash }); return win.focus().catch(() => {}); }
    return self.clients.openWindow(target);
  }));
});
